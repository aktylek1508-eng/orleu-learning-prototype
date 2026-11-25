export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Тек POST сұрауы қолданылады.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'ИИ генераторын іске қосу үшін Vercel жобасына OPENAI_API_KEY құпия айнымалысын қосу қажет.' });
  const { file, questionCount = 5, level = 'Средний', customInstructions = '' } = req.body || {};
  if (!file?.name || !file?.data) return res.status(400).json({ error: 'Файл деректері берілмеді.' });
  const extension = file.name.toLowerCase().split('.').pop();
  const types = { pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',rtf:'application/rtf',odt:'application/vnd.oasis.opendocument.text',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',tsv:'text/tsv',txt:'text/plain',md:'text/markdown',json:'application/json',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif' };
  const mime = types[extension];
  if (!mime) return res.status(415).json({ error: 'Бұл файл түрін қолдамаймыз. PDF, фото, Word, PowerPoint, Excel немесе мәтіндік құжатты таңдаңыз.' });
  if (!/^[A-Za-z0-9+/=]+$/.test(file.data) || Buffer.byteLength(file.data, 'base64') > 3 * 1024 * 1024) return res.status(413).json({ error: 'Файл 3 МБ-тан үлкен немесе форматы жарамсыз.' });
  const count = Math.max(3, Math.min(8, Number(questionCount) || 5));
  const safeLevel = ['Базовый','Средний','Продвинутый'].includes(level) ? level : 'Средний';
  const isImage = mime.startsWith('image/');
  const content = isImage ? [{ type: 'input_image', image_url: `data:${mime};base64,${file.data}`, detail: 'high' }] : [{ type: 'input_file', filename: file.name, file_data: `data:${mime};base64,${file.data}`, ...(mime === 'application/pdf' ? { detail: 'high' } : {}) }];
  content.push({ type: 'input_text', text: `Сен мұғалімге оқу материалы бойынша тест тапсырмасын дайындайсың. Материалдың тақырыбын анықтап, мазмұнына сүйен. Оқушыларға арналған барлық мәтінді қазақ тілінде жаз. Жалған дерек немесе материалда жоқ жауап қоспа. Деңгей: ${safeLevel}. Дәл ${count} көп таңдаулы сұрақ құрастыр. Әр сұраққа төрт ықшам жауап нұсқасын және дұрыс жауаптың 0-ден басталатын индексін бер. Егер материал оқылмаса немесе оқу мазмұны жоқ болса, сұрақтарды бос қалдыр. Қосымша нұсқау: ${String(customInstructions).slice(0,500) || 'жоқ'}` });
  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' }, body:JSON.stringify({ model:process.env.OPENAI_MODEL || 'gpt-5.4-mini', store:false, input:[{role:'user',content}], text:{ format:{ type:'json_schema', name:'generated_assignment', strict:true, schema:{ type:'object',additionalProperties:false,required:['title','topic','questions'],properties:{ title:{type:'string'},topic:{type:'string'},questions:{type:'array',items:{type:'object',additionalProperties:false,required:['text','options','answer'],properties:{text:{type:'string'},options:{type:'array',items:{type:'string'}},answer:{type:'integer'}}}}} } } } }) });
    const data = await upstream.json();
    if (!upstream.ok) { console.error('OpenAI Responses API error', upstream.status, data?.error?.code || data?.error?.type || 'unknown'); return res.status(502).json({ error:'ИИ қызметі жауап бермеді. Біраздан соң қайталап көріңіз.' }); }
    const output = data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
    if (!output) return res.status(502).json({ error:'Материалдан жауап алынбады. Басқа файлды байқап көріңіз.' });
    const task = JSON.parse(output);
    task.questions = (task.questions || []).filter(q => q.text && Array.isArray(q.options) && q.options.length === 4 && q.options.every(Boolean) && q.answer >= 0 && q.answer < 4).slice(0,count);
    if (!task.questions.length) return res.status(422).json({ error:'Материалдан дайын сұрақ құрастыру мүмкін болмады. Анығырақ бет немесе фото жіберіңіз.' });
    return res.status(200).json({ task });
  } catch (error) { console.error('Task generation failed',error?.name || 'Error'); return res.status(502).json({ error:'Тапсырманы жасау кезінде қате шықты. Қайталап көріңіз.' }); }
}