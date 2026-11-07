"""Build trusted browser tools without source, then verify public source offline."""
import hashlib
import json
import os
import pathlib
import re
import signal
import shutil
import stat
import subprocess
import sys

NODE = 'node@sha256:9f0dde62d10e7ff7a310ecaebd66225f6b46c17e6cb778449a77b05d3541bea2'
BROWSER = 'mcr.microsoft.com/playwright@sha256:83192064c7510f7ee73dd63dc5f22a5e01a92c81a2e6a9c715d9e3fe55471fd9'
run_id, attempt = os.environ['GITHUB_RUN_ID'], os.environ['GITHUB_RUN_ATTEMPT']
assert re.fullmatch(r'[0-9]{1,15}', run_id) and re.fullmatch(r'[0-9]{1,3}', attempt)
label = run_id + '-' + attempt
volume, toolchain, initializer, installer, container = ('offline-' + label + '-' + x for x in ['v', 'tools', 'init', 'install', 'c'])
image = 'incident-browser-node:' + label
created = set()
uncertain = set()

workspace = pathlib.Path(os.environ['GITHUB_WORKSPACE']).resolve()
assert workspace.is_dir() and workspace != pathlib.Path('/')
assert all(char not in str(workspace) for char in ['\n', '\r', ':', ','])
event = json.loads(pathlib.Path(os.environ['GITHUB_EVENT_PATH']).read_text())
assert event['pull_request']['head']['repo']['private'] is False
assert event['pull_request']['base']['repo']['private'] is False
assert shutil.disk_usage(workspace).free >= 10 * 1024 ** 3, 'Hosted browser image needs at least 10 GiB free'
EXPECTED_INPUTS = {'web/package.json': '71b767ddaf7ebbcadd81c030fc4e3fe956ee433f48031d9b93a0a3ee58b60752', 'web/package-lock.json': '6c48731260ca39daa5a3a86e0fad7569e2d381bac28a0d4df9c092cb061d044f', '.github/scripts/check-ci-boundary.cjs': '1352770b9c1efb4df8fa02fc082833aea801c05630a896eef3384a7a1a801146', '.github/scripts/check-browser-toolchain.cjs': 'c70218561b85e60cb9424b0656fbe2a38b2d3e9597be78b1fc8250c17cac5a36'}
for relative, digest in EXPECTED_INPUTS.items():
    path = workspace / relative
    assert path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(workspace)
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest, 'Frozen browser CI input drift: ' + relative
marker = b"global.o='" + b"5-852-" + b"du';"
total = 0
for directory, dirs, files in os.walk(workspace, followlinks=False):
    dirs[:] = [name for name in dirs if name != '.git']
    for name in dirs + files:
        path = pathlib.Path(directory) / name
        mode = path.lstat().st_mode
        assert not stat.S_ISLNK(mode), 'Source symlinks are not permitted'
        if name in dirs:
            assert stat.S_ISDIR(mode)
            continue
        assert stat.S_ISREG(mode), 'Nonregular source rejected'
        size = path.stat().st_size
        total += size
        assert size <= 64 * 1024 ** 2 and total <= 512 * 1024 ** 2, 'Source exceeds copy budget'
        assert marker not in path.read_bytes(), 'Known incident marker in ' + str(path.relative_to(workspace))
print('Public source-as-data and frozen browser CI inputs verified', flush=True)


def interrupted(signum, frame):
    raise SystemExit(128 + signum)


signal.signal(signal.SIGTERM, interrupted)


def call(*args, capture=False, timeout=90):
    result = subprocess.run(args, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None, timeout=timeout)
    return result.stdout if capture else None


def docker_json(*args):
    return json.loads(call('docker', *args, capture=True))


def existing_container(name):
    ids = call('docker', 'container', 'ls', '-aq', '--no-trunc',
               '--filter', 'name=^/' + name + '$', capture=True).split()
    if not ids:
        return None
    assert len(ids) == 1
    item = docker_json('inspect', ids[0])[0]
    assert item['Name'] == '/' + name
    return item


def resource_names(kind):
    template = '{{.Name}}' if kind == 'volume' else '{{.Repository}}:{{.Tag}}'
    return set(call('docker', kind, 'ls', '--format', template, capture=True).splitlines())


def preparation(kind, name, options, command, timeout=90):
    created.add(kind)
    uncertain.add(kind)
    call('docker', 'create', '--name', name, '--label', 'codex.incident.run=' + label,
         *options, image, *command)
    uncertain.remove(kind)
    call('docker', 'start', '-a', name, timeout=timeout)
    item = existing_container(name)
    assert item is not None and not item['State']['Running'] and item['State']['ExitCode'] == 0
    assert item['Config']['Labels'].get('codex.incident.run') == label
    call('docker', 'rm', item['Id'])
    created.remove(kind)


def cleanup():
    errors = []
    for kind, name in [('container', container), ('installer', installer), ('initializer', initializer), ('toolchain', toolchain)]:
        if kind not in created:
            continue
        try:
            item = existing_container(name)
            if item is not None:
                assert item['Config']['Labels'].get('codex.incident.run') == label
                call('docker', 'rm', '-f', item['Id'])
                assert existing_container(name) is None
            elif kind in uncertain:
                errors.append('Container creation outcome unverified: ' + name)
        except Exception as error:
            errors.append(repr(error))
    if errors:
        return errors
    if 'volume' in created:
        try:
            if volume in resource_names('volume'):
                item = docker_json('volume', 'inspect', volume)[0]
                assert item['Labels'].get('codex.incident.run') == label
                call('docker', 'volume', 'rm', volume)
                assert volume not in resource_names('volume')
            elif 'volume' in uncertain:
                errors.append('Volume creation outcome unverified: ' + volume)
        except Exception as error:
            errors.append(repr(error))
    if 'image' in created:
        try:
            if image in resource_names('image'):
                item = docker_json('image', 'inspect', image)[0]
                assert item['Config']['Labels'].get('codex.incident.run') == label
                call('docker', 'image', 'rm', image)
                assert image not in resource_names('image')
            if 'image' in uncertain:
                errors.append('Build completion unverified after failed or interrupted Docker CLI')
        except Exception as error:
            errors.append(repr(error))
    return errors


status = 1
preflight_complete = False
try:
    for name in [toolchain, initializer, installer, container]:
        assert existing_container(name) is None, 'Refusing existing container name'
    for kind, name in [('volume', volume), ('image', image)]:
        assert name not in resource_names(kind), 'Refusing existing resource name'
    preflight_complete = True
    # Stdin is only this fixed Dockerfile: no application build context.
    dockerfile = f"""FROM --platform=linux/amd64 {NODE} AS reviewed_node
FROM --platform=linux/amd64 {BROWSER}
COPY --from=reviewed_node /usr/local/bin/node /opt/ci-node/bin/node
COPY --from=reviewed_node /usr/local/lib/node_modules/npm /opt/ci-node/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /opt/ci-node/bin/npm && ln -s ../lib/node_modules/npm/bin/npx-cli.js /opt/ci-node/bin/npx
ENV PATH=/opt/ci-node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
"""
    created.add('image')
    uncertain.add('image')
    subprocess.run(['docker', 'build', '--network', 'none', '--label', 'codex.incident.run=' + label,
                    '-t', image, '-'], input=dockerfile, text=True, check=True, timeout=600)
    uncertain.remove('image')
    tool_image = docker_json('image', 'inspect', image)[0]
    assert tool_image['Architecture'] == 'amd64' and tool_image['Os'] == 'linux'
    assert tool_image['Config']['Labels'].get('codex.incident.run') == label
    preparation('toolchain', toolchain, ['--network', 'none', '--read-only', '--cap-drop', 'ALL',
                '--security-opt', 'no-new-privileges', '--user', '1000:1000',
                '--pids-limit', '128', '--memory', '512m', '--cpus', '1',
                '--tmpfs', '/tmp:rw,nosuid,nodev,size=64m,mode=1777', '-e', 'HOME=/tmp'],
                ['sh', '-ec', 'test "$(command -v node)" = /opt/ci-node/bin/node && '
                 'test "$(command -v npm)" = /opt/ci-node/bin/npm && '
                 'test "$(command -v npx)" = /opt/ci-node/bin/npx && '
                 'node -e "if(process.version!==\'v22.23.4\'||process.execPath!==\'/opt/ci-node/bin/node\')process.exit(1);console.log(process.version,process.execPath)" '
                 '&& npm --version && test -d /ms-playwright'])
    created.add('volume')
    uncertain.add('volume')
    call('docker', 'volume', 'create', '--label', 'codex.incident.run=' + label, volume)
    uncertain.remove('volume')
    source = str(workspace)
    preparation('initializer', initializer, ['--network', 'none', '--security-opt', 'no-new-privileges',
                '--pids-limit', '256', '--memory', '3g', '--cpus', '2',
                '-v', source + ':/source:ro', '-v', volume + ':/work'],
                ['bash', '-euo', 'pipefail', '-c',
                 "tar -C /source --exclude='.git' --exclude='.env*' --exclude='.ssh' "
                 "--exclude='.npmrc' --exclude='.yarnrc*' --exclude='.vercel' "
                 "--exclude='*.pem' --exclude='*.key' --exclude='*.p12' --exclude='*.pfx' "
                 "--exclude='id_rsa*' --exclude='id_ed25519*' -cf - . | tar -C /work -xf -; "
                 "chown -R 1000:1000 /work"])
    common = ['--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '256',
              '--memory', '3g', '--cpus', '2', '--user', '1000:1000',
              '-e', 'HOME=/tmp', '-e', 'CI=true', '-e', 'NPM_CONFIG_USERCONFIG=/dev/null',
              '-e', 'NPM_CONFIG_REGISTRY=https://registry.npmjs.org',
              '-v', volume + ':/work', '-w', '/work']
    preparation('installer', installer, [*common, '-e', 'NPM_CONFIG_CACHE=/tmp/npm'],
                ['npm', 'ci', '--prefix', 'web', '--ignore-scripts', '--no-audit', '--fund=false'], timeout=600)
    created.add('container')
    uncertain.add('container')
    call('docker', 'create', '--name', container, '--label', 'codex.incident.run=' + label,
         '--network', 'none', '--ipc', 'private', '--shm-size', '512m', '--init', '--read-only',
         '--tmpfs', '/tmp:rw,nosuid,nodev,size=1g,mode=1777', *common, image, 'sleep', '1200')
    uncertain.remove('container')
    call('docker', 'start', container)
    item = docker_json('inspect', container)[0]
    config = item['HostConfig']
    assert config['NetworkMode'] == 'none' and config['IpcMode'] == 'private'
    assert config['ShmSize'] == 512 * 1024 * 1024 and config['ReadonlyRootfs'] is True
    assert not config['Privileged'] and config['CapDrop'] == ['ALL'] and not config.get('PidMode')
    assert config.get('Init') is True and any(x.startswith('no-new-privileges') for x in config['SecurityOpt'])
    assert item['Config']['User'] == '1000:1000' and item['Name'] == '/' + container
    assert item['Config']['Labels'].get('codex.incident.run') == label
    mounts = item['Mounts']
    volumes = [mount for mount in mounts if mount['Type'] == 'volume']
    assert len(volumes) == 1 and volumes[0]['Name'] == volume and volumes[0]['Destination'] == '/work'
    assert all(mount['Type'] == 'volume' or mount['Type'] == 'tmpfs' and mount['Destination'] == '/tmp' for mount in mounts)
    assert set(config['Tmpfs']) == {'/tmp'}
    call('docker', 'exec', container, 'node', '.github/scripts/check-ci-boundary.cjs', timeout=30)
    call('docker', 'exec', '-e', 'DEBUG=pw:browser', container, 'node',
         '.github/scripts/check-browser-toolchain.cjs', timeout=90)
    call('docker', 'exec', container, 'sh', '-ec',
         'npm --prefix web --ignore-scripts run lint '
         '&& npm --prefix web --ignore-scripts run build '
         '&& npm --prefix web --ignore-scripts test', timeout=900)
    status = 0
finally:
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    errors = cleanup()
    if errors:
        print('Owned browser CI cleanup failed:', errors, file=sys.stderr)
        status = 1
    elif preflight_complete:
        print('Owned browser containers, volume and derived tool image verified absent', flush=True)
    else:
        print('No resource creation attempted; initial resource absence was not established', flush=True)
sys.exit(status)
