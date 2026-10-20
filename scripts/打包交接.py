#!/usr/bin/env python3
"""打包全部业务文件，转换文档内项目链接，附文件校验，不携带本机依赖。"""
from __future__ import annotations

import argparse
from datetime import datetime
from hashlib import sha256
import json
import os
from pathlib import Path
import re
from zipfile import ZipFile, ZIP_DEFLATED
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_ROOT = '圆圆的河谷-完整项目交接'
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', 'test-results', '.pytest_cache', '.cache'}
GENERATED = {'handoff/文件清单.json', 'handoff/SHA256SUMS.txt'}
LEGACY_ROOT = '/Users/nan/Documents/ChatGPT/早教游戏'
LINK = re.compile(r'(!?\[[^\]]*\]\()(?P<target><[^>]+>|[^)]+)(\))')


def portable_markdown(data: bytes, relative: str) -> bytes:
    """只改变打包副本中的本项目绝对链接，不改历史正文或外部链接。"""
    text = data.decode('utf-8')
    bases = tuple(dict.fromkeys((str(ROOT), LEGACY_ROOT)))

    def rewrite(match):
        original = match.group('target')
        angled = original.startswith('<') and original.endswith('>')
        target = original[1:-1] if angled else original
        for base in bases:
            if target.startswith(base + '/'):
                local = target[len(base) + 1:]
                suffix = ''
                numbered = re.search(r':\d+$', local)
                if numbered:
                    suffix = local[numbered.start():]
                    local = local[:numbered.start()]
                if '#' in local:
                    local, anchor = local.split('#', 1)
                    suffix = '#' + anchor + suffix
                converted = os.path.relpath(ROOT / local, ROOT / Path(relative).parent).replace(os.sep, '/') + suffix
                if angled or ' ' in converted:
                    converted = '<' + converted + '>'
                return match.group(1) + converted + match.group(3)
        return match.group(0)

    return LINK.sub(rewrite, text).encode('utf-8')


def business_files():
    for directory, dirs, names in os.walk(ROOT):
        dirs[:] = sorted(name for name in dirs if name not in SKIP_DIRS)
        for name in sorted(names):
            path = Path(directory) / name
            rel = path.relative_to(ROOT).as_posix()
            if path.is_symlink():
                raise ValueError(f'不打包未核实的符号链接：{rel}')
            if name == '.DS_Store' or name.startswith('.env') or name.endswith('.local'):
                continue
            if path.suffix.lower() == '.zip' or rel in GENERATED or (rel.startswith('output/') and name.endswith('.zip.sha256')):
                continue
            yield rel, path


def package(destination: Path):
    payload = {}
    for relative, path in business_files():
        data = path.read_bytes()
        payload[relative] = portable_markdown(data, relative) if relative.endswith('.md') else data
    for required in ['开始这里.md', 'AGENTS.md', 'README.md', 'PROJECT_MEMORY.md', 'package.json', 'package-lock.json', 'dist/index.html', 'handoff/项目上下文.md', 'handoff/需求决策记录.md', 'handoff/技术接手说明.md', 'handoff/给AI的接手提示词.md', 'handoff/试玩反馈模板.md']:
        if required not in payload:
            raise ValueError(f'缺少必须交接的文件：{required}')
    entries = [{'path': name, 'bytes': len(data), 'sha256': sha256(data).hexdigest()} for name, data in sorted(payload.items())]
    manifest = {
        'package': ARCHIVE_ROOT,
        'created_at': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(timespec='seconds'),
        'file_count': len(entries),
        'files': entries,
        'excluded': ['node_modules/（npm ci重建）', '.git/（原项目无提交历史）', '旧ZIP与新ZIP自身（防止递归）', '系统/测试缓存', '.env及*.local'],
        'transform': '仅Markdown中指向本项目的绝对文件链接转换为相对链接；历史正文保留。清单不对自身及SHA256SUMS做自引用校验。',
    }
    payload['handoff/文件清单.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    payload['handoff/SHA256SUMS.txt'] = (''.join(f"{entry['sha256']}  {entry['path']}\n" for entry in entries)).encode('utf-8')
    # Keep the generated index available to readers of the unpackaged project too.
    for name in GENERATED:
        (ROOT / name).write_bytes(payload[name])
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, 'w', compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for name, data in sorted(payload.items()):
            archive.writestr(ARCHIVE_ROOT + '/' + name, data)
    with ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise ValueError('ZIP校验失败')
        for name, data in payload.items():
            if archive.read(ARCHIVE_ROOT + '/' + name) != data:
                raise ValueError(f'ZIP写入内容不一致：{name}')
    digest = sha256(destination.read_bytes()).hexdigest()
    checksum = destination.with_name(destination.name + '.sha256')
    checksum.write_text(f'{digest}  {destination.name}\n', encoding='utf-8')
    print(json.dumps({'archive': str(destination), 'bytes': destination.stat().st_size, 'files': len(payload), 'sha256': digest, 'checksum': str(checksum), 'verified': True}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'output' / '圆圆的河谷-完整项目交接-2026-10-14.zip')
    arguments = parser.parse_args()
    package(arguments.output.resolve())
