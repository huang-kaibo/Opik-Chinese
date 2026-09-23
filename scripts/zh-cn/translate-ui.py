"""Build an offline Chinese dictionary from public Opik frontend UI strings."""
import concurrent.futures
import json
from pathlib import Path
import re
import subprocess
import time

import requests


ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'apps/opik-frontend/src/localization/zh-CN.json'
PATTERN_DEST = ROOT / 'apps/opik-frontend/src/localization/zh-CN-patterns.json'
SEPARATOR = '\nZXQSEPZXQ\n'
URL = 'https://translate.googleapis.com/translate_a/single'

OVERRIDES = {
    'Opik': 'Opik',
    'Home': '首页',
    'Workspace': '工作区',
    'Projects': '项目',
    'Project': '项目',
    'Configuration': '配置',
    'Observability': '可观测性',
    'Logs': '日志',
    'Traces': '运行记录',
    'Trace': '运行记录',
    'Spans': '执行步骤',
    'Span': '执行步骤',
    'Development': '开发',
    'Evaluation': '评测',
    'Online evaluation': '在线评测',
    'Datasets': '题库',
    'Dataset': '题库',
    'Create dataset': '创建题库',
    'Test suites': '测试套件',
    'Test suite': '测试套件',
    'Experiments': '实验',
    'Experiment': '实验',
    'Annotation queues': '人工评审队列',
    'Annotation queue': '人工评审队列',
    'Feedback scores': '反馈评分',
    'Feedback score': '反馈评分',
    'Prompt library': '提示词库',
    'Agent playground': 'Agent 调试台',
    'Prompt playground': '提示词调试台',
    'Optimization runs': '优化任务',
    'Production': '生产环境',
    'Dashboards': '仪表盘',
    'Alerts': '告警',
    'Settings': '设置',
    'Search': '搜索',
    'Search by name': '按名称搜索',
    'No search results': '没有搜索结果',
    'Create': '创建',
    'Save': '保存',
    'Save changes': '保存更改',
    'Cancel': '取消',
    'Delete': '删除',
    'Edit': '编辑',
    'Name': '名称',
    'Description': '描述',
    'Created': '创建时间',
    'Created by': '创建者',
    'Last updated': '最近更新',
    'Input': '输入',
    'Output': '输出',
    'Metadata': '元数据',
    'Comments': '评论',
    'Tags': '标签',
    'Duration': '耗时',
    'Estimated cost': '预估费用',
    'Total tokens': 'Token 总数',
    'Error': '错误',
    'Errors': '错误',
    'Failed': '失败',
    'Run': '运行',
    'Compare': '比较',
    'Baseline': '基线',
    'Model': '模型',
    'LLM provider': '模型服务商',
    'API key': 'API 密钥',
    'No datasets yet': '暂无题库',
    'There are no datasets yet': '暂无题库',
    'Markdown': 'Markdown',
    'LLM': 'LLM',
    'LLM messages': 'LLM 消息',
    'Provider': '服务商',
    'Thread': '会话',
    'Threads': '会话',
    'Edit annotation queue': '编辑人工评审队列',
    'No instructions were provided for this annotation queue': '该人工评审队列尚无评审说明',
    'Page ZXQ0ZXQ of ZXQ1ZXQ': '第 ZXQ0ZXQ 页，共 ZXQ1ZXQ 页',
}

PROPER_NAME = re.compile(
    r'^(?:Claude|Gemini|GPT|OpenAI|Anthropic|DeepSeek|Qwen|Llama|Mistral|'
    r'Azure|AWS|Google|GitHub|PagerDuty|Markdown|JSON|Python|JavaScript|'
    r'TypeScript|OpenRouter|Ollama)(?:[ \w.\-]*)$', re.I,
)


def refine(source, value):
    if source in OVERRIDES:
        return OVERRIDES[source]
    if PROPER_NAME.fullmatch(source):
        return source
    value = value.replace('法学硕士', 'LLM').replace('大型语言模型', 'LLM')
    if re.search(r'\bannotation\b', source, re.I):
        value = value.replace('注释', '标注')
    if re.search(r'\bannotation queues?\b', source, re.I):
        value = value.replace('标注队列', '人工评审队列')
    if re.search(r'\btraces?\b', source, re.I):
        value = value.replace('迹线', '运行记录').replace('痕迹', '运行记录')
    if re.search(r'\bspans?\b', source, re.I):
        value = value.replace('跨度', '执行步骤')
    if re.search(r'\bthreads?\b', source, re.I):
        value = value.replace('线程', '会话').replace('话题', '会话')
    if re.search(r'\bsuites?\b', source, re.I):
        value = value.replace('套房', '套件')
    if re.search(r'\btrials?\b', source, re.I):
        value = value.replace('试用', '试验')
    if re.search(r'\bcalls?\b', source, re.I):
        value = value.replace('通话', '调用')
    if re.search(r'\bprompts?\b', source, re.I):
        value = re.sub(r'提示(?!词)', '提示词', value)
    return value


def fetch(batch):
    query = SEPARATOR.join(batch)
    for attempt in range(5):
        try:
            response = requests.get(URL, params={
                'client': 'gtx', 'sl': 'en', 'tl': 'zh-CN', 'dt': 't', 'q': query,
            }, timeout=45)
            response.raise_for_status()
            payload = response.json()
            translated = ''.join(part[0] for part in payload[0]).split('ZXQSEPZXQ')
            if len(translated) != len(batch):
                raise ValueError(f'Expected {len(batch)} translations, got {len(translated)}')
            for original, target in zip(batch, translated):
                markers = lambda text: sorted(re.findall(r'ZXQ\d+ZXQ', text))
                if markers(original) != markers(target):
                    raise ValueError(f'Placeholder mismatch for {original!r}')
            return dict(zip(batch, (item.strip() for item in translated)))
        except (requests.RequestException, ValueError, KeyError, IndexError):
            if attempt == 4:
                if len(batch) > 1:
                    result = {}
                    for item in batch:
                        result.update(fetch([item]))
                    return result
                raise
            time.sleep(2 ** attempt)


def translate_inventory(dest, args):
    inventory = json.loads(subprocess.check_output(
        ['node', str(ROOT / 'scripts/zh-cn/extract-ui-strings.mjs'), *args], cwd=ROOT,
    ))
    expected = {item['en'] for item in inventory}
    dest.parent.mkdir(parents=True, exist_ok=True)
    existing = json.loads(dest.read_text(encoding='utf-8')) if dest.exists() else {}
    result = {key: value for key, value in existing.items() if key in expected and value}
    result.update({key: value for key, value in OVERRIDES.items() if key in expected})
    pending = [item for item in sorted(expected) if item not in result]
    batches = []
    current = []
    length = 0
    for item in pending:
        if len(current) >= 8 or length + len(item) > 3500:
            batches.append(current)
            current, length = [], 0
        current.append(item)
        length += len(item)
    if current:
        batches.append(current)
    print(f'{len(expected)} candidate strings; {len(pending)} need translation in {len(batches)} batches', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(fetch, batch) for batch in batches]
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            result.update(future.result())
            if index % 25 == 0 or index == len(batches):
                dest.write_text(json.dumps(dict(sorted(result.items())), ensure_ascii=False,
                                           indent=2) + '\n', encoding='utf-8')
                print(f'{index}/{len(batches)} batches; {len(result)}/{len(expected)} strings', flush=True)
    if expected - result.keys():
        raise RuntimeError(f'Missing {len(expected - result.keys())} translations')
    result = {key: refine(key, value) for key, value in result.items()}
    dest.write_text(json.dumps(dict(sorted(result.items())), ensure_ascii=False,
                               indent=2) + '\n', encoding='utf-8')
    print(f'Complete: {len(result)} strings in {dest}', flush=True)


def main():
    translate_inventory(DEST, [])
    translate_inventory(PATTERN_DEST, ['--templates'])


if __name__ == '__main__':
    main()
