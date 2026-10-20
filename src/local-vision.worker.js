import {
  env, AutoProcessor, AutoModelForVision2Seq, TextStreamer, InterruptableStoppingCriteria, load_image,
} from '@huggingface/transformers';

// Weights are cached in the browser. The mirror is reachable from networks that block huggingface.co.
env.allowLocalModels = false;
env.useBrowserCache = true;
env.remoteHost = 'https://hf-mirror.com/';

const MODEL_ID = 'HuggingFaceTB/SmolVLM-256M-Instruct';
const MAX_NEW_TOKENS = 480;

function promptFor(title, idea) {
  return [
    '看这张儿童画。只输出一个 JSON 对象，不要其他文字。',
    `名称提示：${title || '（没写）'}`,
    `想法：${idea || '（没写）'}`,
    '数清胳膊、腿、眼睛、翅膀。看不见的不要写。名单里没有的部位放进 parts。',
    '{"name":"","kind":"humanoid或creature或object","main":"#rrggbb","accent":"#rrggbb","extra":"#rrggbb","arms":2,"legs":2,"eyes":2,"wings":0,"features":[],"details":[],"parts":[{"name":"短中文","shape":"sphere","anchor":"body","size":"medium","color":"accent"}],"summary":""}',
    'kind：人、英雄、机器人用 humanoid；动物用 creature；其他用 object。',
    'features 只能从这些里选：crest chest-lamp wings tail long-ears horns hat fins wheels spots beak mane cape belt antenna gloves boots stripes armor joints thruster visor claws gear pipes。',
    'parts 的 shape 用 box、sphere、cylinder、cone。anchor 用 head、body、back、chest、left、right、top。size 用 small、medium、large。',
  ].join('\n');
}

class SmolVLM {
  static async getInstance(progress_callback) {
    this.processor ??= AutoProcessor.from_pretrained(MODEL_ID, { progress_callback });
    this.model ??= AutoModelForVision2Seq.from_pretrained(MODEL_ID, {
      dtype: 'fp32',
      device: 'webgpu',
      progress_callback,
    });
    return Promise.all([this.processor, this.model]);
  }
}

const stopping = new InterruptableStoppingCriteria();

async function generate(data) {
  const [processor, model] = await SmolVLM.getInstance(progress => self.postMessage(progress));
  const image = await load_image(data.image);
  const messages = [{
    role: 'user',
    content: [
      { type: 'image', image: data.image },
      { type: 'text', text: promptFor(data.title, data.idea) },
    ],
  }];
  const text = processor.apply_chat_template(messages, { add_generation_prompt: true });
  const inputs = await processor(text, [image]);
  let output = '';
  const streamer = new TextStreamer(processor.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: chunk => {
      output += chunk;
      self.postMessage({ status: 'update', output });
    },
  });
  self.postMessage({ status: 'start' });
  await model.generate({
    ...inputs,
    do_sample: false,
    repetition_penalty: 1.1,
    max_new_tokens: MAX_NEW_TOKENS,
    streamer,
    stopping_criteria: stopping,
  });
  self.postMessage({ status: 'complete', output });
}

self.addEventListener('message', async event => {
  const { type, data } = event.data || {};
  try {
    if (type === 'interrupt') {
      stopping.interrupt();
      return;
    }
    if (type === 'generate') {
      stopping.reset();
      await generate(data);
    }
  } catch (error) {
    self.postMessage({ status: 'error', data: error?.message || String(error) });
  }
});
