use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;

declare_id!("E7oLP2LUd16wRVDp6hZfC8xxbG7TfMmjtEeaWyYWqt2");

const MATCH_SEED: &[u8] = b"xiangqi";
const BOARD_LEN: usize = 90;
const RED: u8 = 0x10;
const BLACK: u8 = 0x20;
const GENERAL: u8 = 1;
const ADVISOR: u8 = 2;
const ELEPHANT: u8 = 3;
const HORSE: u8 = 4;
const ROOK: u8 = 5;
const CANNON: u8 = 6;
const SOLDIER: u8 = 7;

const WAITING: u8 = 0;
const ACTIVE: u8 = 1;
const RED_WON: u8 = 2;
const BLACK_WON: u8 = 3;
const DRAW: u8 = 4;
const CANCELLED: u8 = 5;
const NO_DRAW_OFFER: u8 = 0;
const END_NONE: u8 = 0;
const END_CAPTURE: u8 = 1;
const END_NO_LEGAL_MOVE: u8 = 2;
const END_RESIGNATION: u8 = 3;
const END_TIMEOUT: u8 = 4;
const END_AGREED_DRAW: u8 = 5;
const MIN_TURN_TIMEOUT_SECONDS: i64 = 60;
const MAX_TURN_TIMEOUT_SECONDS: i64 = 86_400;
const MAX_JOIN_WINDOW_SECONDS: i64 = 86_400;
const MAX_STAKE_LAMPORTS: u64 = 10_000_000_000;

#[ephemeral]
#[program]
pub mod xiangqi_match {
    use super::*;

    pub fn initialize_match(
        ctx: Context<InitializeMatch>,
        match_id: u64,
        stake_lamports: u64,
        join_deadline: i64,
        turn_timeout_seconds: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(stake_lamports > 0, XiangqiError::InvalidStake);
        require!(
            stake_lamports <= MAX_STAKE_LAMPORTS,
            XiangqiError::StakeTooLarge
        );
        require!(join_deadline > now, XiangqiError::InvalidJoinDeadline);
        require!(
            join_deadline <= now.saturating_add(MAX_JOIN_WINDOW_SECONDS),
            XiangqiError::InvalidJoinDeadline
        );
        require!(
            (MIN_TURN_TIMEOUT_SECONDS..=MAX_TURN_TIMEOUT_SECONDS).contains(&turn_timeout_seconds),
            XiangqiError::InvalidTurnTimeout
        );

        let game = &mut ctx.accounts.game;
        game.match_id = match_id;
        game.red = ctx.accounts.red.key();
        game.black = Pubkey::default();
        game.board = initial_board();
        game.turn = RED;
        game.status = WAITING;
        game.ply = 0;
        game.bump = ctx.bumps.game;
        game.stake_lamports = stake_lamports;
        game.created_at = now;
        game.join_deadline = join_deadline;
        game.last_action_at = now;
        game.turn_timeout_seconds = turn_timeout_seconds;
        game.draw_offer = NO_DRAW_OFFER;
        game.settled = false;
        game.last_from = u8::MAX;
        game.last_to = u8::MAX;
        game.last_player = Pubkey::default();
        game.end_reason = END_NONE;

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.red.to_account_info(),
                    to: game.to_account_info(),
                },
            ),
            stake_lamports,
        )?;

        emit!(StakeDeposited {
            game: game.key(),
            player: game.red,
            amount: stake_lamports,
            total_pot: stake_lamports,
        });
        Ok(())
    }

    pub fn join_match(ctx: Context<JoinMatch>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        require!(game.status == WAITING, XiangqiError::MatchAlreadyStarted);
        require!(now <= game.join_deadline, XiangqiError::JoinDeadlinePassed);
        require!(
            ctx.accounts.black.key() != game.red,
            XiangqiError::SamePlayer
        );
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.black.to_account_info(),
                    to: game.to_account_info(),
                },
            ),
            game.stake_lamports,
        )?;
        game.black = ctx.accounts.black.key();
        game.status = ACTIVE;
        game.last_action_at = now;
        emit!(StakeDeposited {
            game: game.key(),
            player: game.black,
            amount: game.stake_lamports,
            total_pot: game.stake_lamports.saturating_mul(2),
        });
        Ok(())
    }

    pub fn play_move(ctx: Context<PlayMove>, from: u8, to: u8) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.status == ACTIVE, XiangqiError::MatchNotActive);
        let expected_player = if game.turn == RED {
            game.red
        } else {
            game.black
        };
        require_keys_eq!(
            ctx.accounts.player.key(),
            expected_player,
            XiangqiError::WrongPlayer
        );
        require!(
            is_legal_move(&game.board, game.turn, from, to),
            XiangqiError::IllegalMove
        );

        let captured = game.board[to as usize];
        let moving = game.board[from as usize];
        game.board[from as usize] = 0;
        game.board[to as usize] = moving;
        game.ply = game.ply.checked_add(1).ok_or(XiangqiError::MoveOverflow)?;
        game.last_action_at = Clock::get()?.unix_timestamp;
        game.draw_offer = NO_DRAW_OFFER;
        game.last_from = from;
        game.last_to = to;
        game.last_player = ctx.accounts.player.key();

        if piece_kind(captured) == GENERAL {
            game.status = if game.turn == RED { RED_WON } else { BLACK_WON };
            game.end_reason = END_CAPTURE;
        } else {
            game.turn = opposite(game.turn);
            if !has_legal_move(&game.board, game.turn) {
                game.status = if game.turn == RED { BLACK_WON } else { RED_WON };
                game.end_reason = END_NO_LEGAL_MOVE;
            }
        }

        emit!(MovePlayed {
            game: game.key(),
            player: ctx.accounts.player.key(),
            ply: game.ply,
            from,
            to,
            captured,
            status: game.status,
        });
        Ok(())
    }

    pub fn claim_victory(ctx: Context<PlayMove>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.status == ACTIVE, XiangqiError::MatchNotActive);
        let winner = opposite(game.turn);
        let expected_player = if winner == RED { game.red } else { game.black };
        require_keys_eq!(
            ctx.accounts.player.key(),
            expected_player,
            XiangqiError::WrongPlayer
        );
        require!(
            !has_legal_move(&game.board, game.turn),
            XiangqiError::MatchHasLegalMoves
        );
        game.status = if winner == RED { RED_WON } else { BLACK_WON };
        game.end_reason = END_NO_LEGAL_MOVE;
        emit!(MatchFinished {
            game: game.key(),
            winner: expected_player,
            status: game.status,
        });
        Ok(())
    }

    pub fn resign(ctx: Context<PlayMove>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.status == ACTIVE, XiangqiError::MatchNotActive);
        let player = ctx.accounts.player.key();
        require!(
            player == game.red || player == game.black,
            XiangqiError::WrongPlayer
        );
        let winner = if player == game.red {
            game.black
        } else {
            game.red
        };
        game.status = if player == game.red {
            BLACK_WON
        } else {
            RED_WON
        };
        game.end_reason = END_RESIGNATION;
        emit!(MatchFinished {
            game: game.key(),
            winner,
            status: game.status,
        });
        Ok(())
    }

    pub fn offer_draw(ctx: Context<PlayMove>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.status == ACTIVE, XiangqiError::MatchNotActive);
        let player = ctx.accounts.player.key();
        let side = game.side_for(player)?;
        game.draw_offer = side;
        emit!(DrawOffered {
            game: game.key(),
            player
        });
        Ok(())
    }

    pub fn accept_draw(ctx: Context<PlayMove>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.status == ACTIVE, XiangqiError::MatchNotActive);
        require!(game.draw_offer != NO_DRAW_OFFER, XiangqiError::NoDrawOffer);
        let player = ctx.accounts.player.key();
        let side = game.side_for(player)?;
        require!(side != game.draw_offer, XiangqiError::CannotAcceptOwnDraw);
        game.status = DRAW;
        game.end_reason = END_AGREED_DRAW;
        game.draw_offer = NO_DRAW_OFFER;
        emit!(MatchFinished {
            game: game.key(),
            winner: Pubkey::default(),
            status: DRAW,
        });
        Ok(())
    }

    pub fn claim_timeout(ctx: Context<PlayMove>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        require!(game.status == ACTIVE, XiangqiError::MatchNotActive);
        require!(
            now >= game
                .last_action_at
                .saturating_add(game.turn_timeout_seconds),
            XiangqiError::TurnNotTimedOut
        );
        let winner_side = opposite(game.turn);
        let winner = if winner_side == RED {
            game.red
        } else {
            game.black
        };
        require_keys_eq!(ctx.accounts.player.key(), winner, XiangqiError::WrongPlayer);
        game.status = if winner_side == RED {
            RED_WON
        } else {
            BLACK_WON
        };
        game.end_reason = END_TIMEOUT;
        emit!(MatchFinished {
            game: game.key(),
            winner,
            status: game.status
        });
        Ok(())
    }

    pub fn cancel_waiting_match(ctx: Context<CancelWaitingMatch>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.status == WAITING, XiangqiError::MatchAlreadyStarted);
        require!(!game.settled, XiangqiError::AlreadySettled);
        game.status = CANCELLED;
        game.settled = true;
        transfer_from_game(
            &game.to_account_info(),
            &ctx.accounts.red.to_account_info(),
            game.stake_lamports,
        )?;
        emit!(MatchCancelled {
            game: game.key(),
            player: game.red,
            refund: game.stake_lamports,
        });
        Ok(())
    }

    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(!game.settled, XiangqiError::AlreadySettled);
        let stake = game.stake_lamports;
        let plan = payout_plan(game.status, stake)?;
        let pot = stake.checked_mul(2).ok_or(XiangqiError::PayoutOverflow)?;
        match plan {
            PayoutPlan::Red(amount) => transfer_from_game(
                &game.to_account_info(),
                &ctx.accounts.red.to_account_info(),
                amount,
            )?,
            PayoutPlan::Black(amount) => transfer_from_game(
                &game.to_account_info(),
                &ctx.accounts.black.to_account_info(),
                amount,
            )?,
            PayoutPlan::Draw(red_refund, black_refund) => {
                transfer_from_game(
                    &game.to_account_info(),
                    &ctx.accounts.red.to_account_info(),
                    red_refund,
                )?;
                transfer_from_game(
                    &game.to_account_info(),
                    &ctx.accounts.black.to_account_info(),
                    black_refund,
                )?;
            }
        }
        game.settled = true;
        emit!(MatchSettled {
            game: game.key(),
            status: game.status,
            red: game.red,
            black: game.black,
            pot,
        });
        Ok(())
    }

    pub fn delegate_match(ctx: Context<DelegateMatch>, match_id: u64) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[
                MATCH_SEED,
                ctx.accounts.payer.key.as_ref(),
                &match_id.to_le_bytes(),
            ],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|account| account.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn commit_match(ctx: Context<CommitMatch>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.game.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn commit_and_undelegate(ctx: Context<CommitMatch>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.game.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct InitializeMatch<'info> {
    #[account(
        init,
        payer = red,
        space = XiangqiMatch::SPACE,
        seeds = [MATCH_SEED, red.key().as_ref(), &match_id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, XiangqiMatch>,
    #[account(mut)]
    pub red: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinMatch<'info> {
    #[account(
        mut,
        seeds = [MATCH_SEED, game.red.as_ref(), &game.match_id.to_le_bytes()],
        bump = game.bump
    )]
    pub game: Account<'info, XiangqiMatch>,
    #[account(mut)]
    pub black: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlayMove<'info> {
    #[account(
        mut,
        seeds = [MATCH_SEED, game.red.as_ref(), &game.match_id.to_le_bytes()],
        bump = game.bump
    )]
    pub game: Account<'info, XiangqiMatch>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelWaitingMatch<'info> {
    #[account(
        mut,
        seeds = [MATCH_SEED, game.red.as_ref(), &game.match_id.to_le_bytes()],
        bump = game.bump,
        has_one = red
    )]
    pub game: Account<'info, XiangqiMatch>,
    #[account(mut)]
    pub red: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(
        mut,
        seeds = [MATCH_SEED, game.red.as_ref(), &game.match_id.to_le_bytes()],
        bump = game.bump
    )]
    pub game: Account<'info, XiangqiMatch>,
    #[account(mut, address = game.red)]
    pub red: SystemAccount<'info>,
    #[account(mut, address = game.black)]
    pub black: SystemAccount<'info>,
    pub payer: Signer<'info>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct DelegateMatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The match PDA is checked by its seeds before delegation.
    #[account(
        mut,
        del,
        seeds = [MATCH_SEED, payer.key().as_ref(), &match_id.to_le_bytes()],
        bump
    )]
    pub pda: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitMatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub game: Account<'info, XiangqiMatch>,
}

#[account]
pub struct XiangqiMatch {
    pub match_id: u64,
    pub red: Pubkey,
    pub black: Pubkey,
    pub board: [u8; BOARD_LEN],
    pub turn: u8,
    pub status: u8,
    pub ply: u16,
    pub bump: u8,
    pub stake_lamports: u64,
    pub created_at: i64,
    pub join_deadline: i64,
    pub last_action_at: i64,
    pub turn_timeout_seconds: i64,
    pub draw_offer: u8,
    pub settled: bool,
    pub last_from: u8,
    pub last_to: u8,
    pub last_player: Pubkey,
    pub end_reason: u8,
}

impl XiangqiMatch {
    pub const SPACE: usize =
        8 + 8 + 32 + 32 + BOARD_LEN + 1 + 1 + 2 + 1 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 32 + 1;

    fn side_for(&self, player: Pubkey) -> Result<u8> {
        if player == self.red {
            Ok(RED)
        } else if player == self.black {
            Ok(BLACK)
        } else {
            err!(XiangqiError::WrongPlayer)
        }
    }
}

#[event]
pub struct MovePlayed {
    pub game: Pubkey,
    pub player: Pubkey,
    pub ply: u16,
    pub from: u8,
    pub to: u8,
    pub captured: u8,
    pub status: u8,
}

#[event]
pub struct MatchFinished {
    pub game: Pubkey,
    pub winner: Pubkey,
    pub status: u8,
}

#[event]
pub struct StakeDeposited {
    pub game: Pubkey,
    pub player: Pubkey,
    pub amount: u64,
    pub total_pot: u64,
}

#[event]
pub struct DrawOffered {
    pub game: Pubkey,
    pub player: Pubkey,
}

#[event]
pub struct MatchCancelled {
    pub game: Pubkey,
    pub player: Pubkey,
    pub refund: u64,
}

#[event]
pub struct MatchSettled {
    pub game: Pubkey,
    pub status: u8,
    pub red: Pubkey,
    pub black: Pubkey,
    pub pot: u64,
}

#[error_code]
pub enum XiangqiError {
    #[msg("The match has already started")]
    MatchAlreadyStarted,
    #[msg("Red and Black must use different wallets")]
    SamePlayer,
    #[msg("The match is not active")]
    MatchNotActive,
    #[msg("This wallet cannot move for the current side")]
    WrongPlayer,
    #[msg("The move violates Xiangqi rules or leaves the general in check")]
    IllegalMove,
    #[msg("The move counter overflowed")]
    MoveOverflow,
    #[msg("The defending side still has a legal move")]
    MatchHasLegalMoves,
    #[msg("The stake must be greater than zero")]
    InvalidStake,
    #[msg("The stake exceeds the program safety cap")]
    StakeTooLarge,
    #[msg("The join deadline must be within the next 24 hours")]
    InvalidJoinDeadline,
    #[msg("The join deadline has passed")]
    JoinDeadlinePassed,
    #[msg("The turn timeout must be between 60 seconds and 24 hours")]
    InvalidTurnTimeout,
    #[msg("No draw offer is active")]
    NoDrawOffer,
    #[msg("A player cannot accept their own draw offer")]
    CannotAcceptOwnDraw,
    #[msg("The active turn has not timed out")]
    TurnNotTimedOut,
    #[msg("This match has already paid out")]
    AlreadySettled,
    #[msg("The match is not ready for payout")]
    MatchNotFinished,
    #[msg("The payout amount overflowed")]
    PayoutOverflow,
    #[msg("The escrow account does not have enough spendable lamports")]
    EscrowUnderfunded,
}

fn transfer_from_game(game: &AccountInfo, recipient: &AccountInfo, amount: u64) -> Result<()> {
    let rent_floor = Rent::get()?.minimum_balance(game.data_len());
    let game_balance = game.lamports();
    let spendable = game_balance.saturating_sub(rent_floor);
    require!(spendable >= amount, XiangqiError::EscrowUnderfunded);
    **game.try_borrow_mut_lamports()? = game_balance
        .checked_sub(amount)
        .ok_or(XiangqiError::EscrowUnderfunded)?;
    **recipient.try_borrow_mut_lamports()? = recipient
        .lamports()
        .checked_add(amount)
        .ok_or(XiangqiError::PayoutOverflow)?;
    Ok(())
}

#[derive(Debug, PartialEq, Eq)]
enum PayoutPlan {
    Red(u64),
    Black(u64),
    Draw(u64, u64),
}

fn payout_plan(status: u8, stake: u64) -> Result<PayoutPlan> {
    let pot = stake.checked_mul(2).ok_or(XiangqiError::PayoutOverflow)?;
    match status {
        RED_WON => Ok(PayoutPlan::Red(pot)),
        BLACK_WON => Ok(PayoutPlan::Black(pot)),
        DRAW => Ok(PayoutPlan::Draw(stake, stake)),
        _ => err!(XiangqiError::MatchNotFinished),
    }
}

fn initial_board() -> [u8; BOARD_LEN] {
    let mut board = [0; BOARD_LEN];
    let back_rank = [
        ROOK, HORSE, ELEPHANT, ADVISOR, GENERAL, ADVISOR, ELEPHANT, HORSE, ROOK,
    ];
    for (file, kind) in back_rank.iter().enumerate() {
        board[index(file as i8, 0)] = RED | kind;
        board[index(file as i8, 9)] = BLACK | kind;
    }
    board[index(1, 2)] = RED | CANNON;
    board[index(7, 2)] = RED | CANNON;
    board[index(1, 7)] = BLACK | CANNON;
    board[index(7, 7)] = BLACK | CANNON;
    for file in [0, 2, 4, 6, 8] {
        board[index(file, 3)] = RED | SOLDIER;
        board[index(file, 6)] = BLACK | SOLDIER;
    }
    board
}

fn is_legal_move(board: &[u8; BOARD_LEN], color: u8, from: u8, to: u8) -> bool {
    if from as usize >= BOARD_LEN || to as usize >= BOARD_LEN || from == to {
        return false;
    }
    let piece = board[from as usize];
    if piece_color(piece) != color || piece_color(board[to as usize]) == color {
        return false;
    }
    if !attacks_square(board, from as usize, to as usize, false) {
        return false;
    }
    let mut next = *board;
    next[to as usize] = piece;
    next[from as usize] = 0;
    !general_in_check(&next, color)
}

fn general_in_check(board: &[u8; BOARD_LEN], color: u8) -> bool {
    let Some(general) = board.iter().position(|piece| *piece == color | GENERAL) else {
        return true;
    };
    board.iter().enumerate().any(|(from, piece)| {
        *piece != 0
            && piece_color(*piece) == opposite(color)
            && attacks_square(board, from, general, true)
    })
}

fn has_legal_move(board: &[u8; BOARD_LEN], color: u8) -> bool {
    for from in 0..BOARD_LEN {
        if piece_color(board[from]) != color {
            continue;
        }
        for to in 0..BOARD_LEN {
            if is_legal_move(board, color, from as u8, to as u8) {
                return true;
            }
        }
    }
    false
}

fn attacks_square(board: &[u8; BOARD_LEN], from: usize, to: usize, checking: bool) -> bool {
    let piece = board[from];
    let color = piece_color(piece);
    let (from_file, from_rank) = coordinates(from);
    let (to_file, to_rank) = coordinates(to);
    let dx = to_file - from_file;
    let dy = to_rank - from_rank;
    match piece_kind(piece) {
        ROOK => {
            (dx == 0 || dy == 0)
                && pieces_between(board, from_file, from_rank, to_file, to_rank) == 0
        }
        CANNON => {
            (dx == 0 || dy == 0)
                && if checking || board[to] != 0 {
                    pieces_between(board, from_file, from_rank, to_file, to_rank) == 1
                } else {
                    pieces_between(board, from_file, from_rank, to_file, to_rank) == 0
                }
        }
        HORSE => {
            let valid = (dx.abs() == 2 && dy.abs() == 1) || (dx.abs() == 1 && dy.abs() == 2);
            if !valid {
                return false;
            }
            let leg = if dx.abs() == 2 {
                (from_file + dx.signum(), from_rank)
            } else {
                (from_file, from_rank + dy.signum())
            };
            board[index(leg.0, leg.1)] == 0
        }
        ELEPHANT => {
            dx.abs() == 2
                && dy.abs() == 2
                && board[index(from_file + dx / 2, from_rank + dy / 2)] == 0
                && if color == RED {
                    to_rank <= 4
                } else {
                    to_rank >= 5
                }
        }
        ADVISOR => dx.abs() == 1 && dy.abs() == 1 && in_palace(to_file, to_rank, color),
        GENERAL => {
            if dx == 0 && board[to] == opposite(color) | GENERAL {
                pieces_between(board, from_file, from_rank, to_file, to_rank) == 0
            } else {
                dx.abs() + dy.abs() == 1 && in_palace(to_file, to_rank, color)
            }
        }
        SOLDIER => {
            let forward = if color == RED { 1 } else { -1 };
            let crossed = if color == RED {
                from_rank >= 5
            } else {
                from_rank <= 4
            };
            (dx == 0 && dy == forward) || (crossed && dy == 0 && dx.abs() == 1)
        }
        _ => false,
    }
}

fn pieces_between(
    board: &[u8; BOARD_LEN],
    from_file: i8,
    from_rank: i8,
    to_file: i8,
    to_rank: i8,
) -> u8 {
    if from_file != to_file && from_rank != to_rank {
        return u8::MAX;
    }
    let step_file = (to_file - from_file).signum();
    let step_rank = (to_rank - from_rank).signum();
    let mut file = from_file + step_file;
    let mut rank = from_rank + step_rank;
    let mut count = 0;
    while file != to_file || rank != to_rank {
        if board[index(file, rank)] != 0 {
            count += 1;
        }
        file += step_file;
        rank += step_rank;
    }
    count
}

fn in_palace(file: i8, rank: i8, color: u8) -> bool {
    (3..=5).contains(&file)
        && if color == RED {
            (0..=2).contains(&rank)
        } else {
            (7..=9).contains(&rank)
        }
}

fn coordinates(square: usize) -> (i8, i8) {
    ((square % 9) as i8, (square / 9) as i8)
}

fn index(file: i8, rank: i8) -> usize {
    (rank as usize) * 9 + file as usize
}

fn piece_color(piece: u8) -> u8 {
    piece & 0xf0
}

fn piece_kind(piece: u8) -> u8 {
    piece & 0x0f
}

fn opposite(color: u8) -> u8 {
    if color == RED {
        BLACK
    } else {
        RED
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_position_has_thirty_two_pieces() {
        assert_eq!(
            initial_board().iter().filter(|piece| **piece != 0).count(),
            32
        );
    }

    #[test]
    fn enforces_horse_leg_cannon_screen_and_river() {
        let mut board = [0; BOARD_LEN];
        board[index(4, 0)] = RED | GENERAL;
        board[index(3, 9)] = BLACK | GENERAL;
        board[index(6, 0)] = RED | HORSE;
        board[index(5, 0)] = RED | SOLDIER;
        assert!(!is_legal_move(
            &board,
            RED,
            index(6, 0) as u8,
            index(4, 1) as u8
        ));

        board[index(4, 1)] = RED | CANNON;
        board[index(4, 4)] = RED | SOLDIER;
        board[index(4, 7)] = BLACK | ROOK;
        assert!(is_legal_move(
            &board,
            RED,
            index(4, 1) as u8,
            index(4, 7) as u8
        ));

        board[index(2, 3)] = RED | SOLDIER;
        assert!(!is_legal_move(
            &board,
            RED,
            index(2, 3) as u8,
            index(3, 3) as u8
        ));
    }

    #[test]
    fn cannot_expose_facing_generals() {
        let mut board = [0; BOARD_LEN];
        board[index(4, 0)] = RED | GENERAL;
        board[index(4, 9)] = BLACK | GENERAL;
        board[index(4, 1)] = RED | ROOK;
        assert!(!is_legal_move(
            &board,
            RED,
            index(4, 1) as u8,
            index(3, 1) as u8
        ));
    }

    #[test]
    fn detects_when_a_side_has_no_legal_move() {
        let mut board = [0; BOARD_LEN];
        board[index(4, 9)] = BLACK | GENERAL;
        board[index(4, 7)] = RED | ROOK;
        board[index(3, 8)] = RED | ROOK;
        board[index(5, 8)] = RED | ROOK;
        board[index(4, 0)] = RED | GENERAL;
        assert!(!has_legal_move(&board, BLACK));
    }

    #[test]
    fn payout_plan_never_creates_or_loses_stake() {
        let stake = 10_000_000;
        assert_eq!(
            payout_plan(RED_WON, stake).unwrap(),
            PayoutPlan::Red(stake * 2)
        );
        assert_eq!(
            payout_plan(BLACK_WON, stake).unwrap(),
            PayoutPlan::Black(stake * 2)
        );
        assert_eq!(
            payout_plan(DRAW, stake).unwrap(),
            PayoutPlan::Draw(stake, stake)
        );
        assert!(payout_plan(ACTIVE, stake).is_err());
        assert!(payout_plan(RED_WON, u64::MAX).is_err());
    }
}
