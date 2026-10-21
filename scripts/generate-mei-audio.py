"""Generate short Mei Valley lines with neural TTS. speechSynthesis remains the fallback."""

from pathlib import Path
import asyncio
import edge_tts

OUT = Path(__file__).resolve().parents[1] / 'public' / 'audio' / 'mei'
EN = 'en-US-AriaNeural'
ZH = 'zh-CN-XiaoxiaoNeural'

LINES = {
    'en-hello': (EN, 'hello'),
    'en-sun': (EN, 'sun'),
    'en-tree': (EN, 'tree'),
    'en-friend': (EN, 'friend'),
    'en-build': (EN, 'build'),
    'en-cat': (EN, 'cat'),
    'en-measure': (EN, 'measure'),
    'en-test': (EN, 'test'),
    'en-fix': (EN, 'fix'),
    'en-change': (EN, "It didn't work. Let's change one thing."),
    'en-action': (EN, 'Action!'),
    'en-cut': (EN, 'Cut!'),
    'en-camera': (EN, 'camera'),
    'en-star': (EN, 'star'),
    'en-light': (EN, 'light'),
    'en-take-two': (EN, 'Take two!'),
    'en-wide': (EN, 'wide shot'),
    'en-medium': (EN, 'medium shot'),
    'en-close': (EN, 'close-up'),
    'en-frames': (EN, 'twenty-four frames'),
    'en-ship': (EN, 'A ship in the stars. Only a balloon can go.'),
    'zh-action': (ZH, '点绿色按钮，一起喊 Action。'),
    'zh-cut': (ZH, '点红色按钮，喊 Cut。'),
    'zh-board': (ZH, '选三张图，排好开头、中间和结尾。'),
    'zh-shot': (ZH, '远景、中景、特写，选一张。'),
    'zh-frames': (ZH, '每秒二十四张，比六张更连贯。'),
    'zh-light': (ZH, '一次只改一盏灯。'),
    'zh-shard': (ZH, '拿到光之片啦。星空里有飞船。只有热气球能去。'),
    'zh-back': (ZH, '绕到后面，是木头架子。没有枪。'),
    'zh-premiere': (ZH, '首映夜。放你拍的。不排名。'),
}


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (voice, text) in LINES.items():
        target = OUT / f'{name}.mp3'
        await edge_tts.Communicate(text, voice, rate='-8%').save(str(target))
        print(target.name, target.stat().st_size)


if __name__ == '__main__':
    asyncio.run(main())
