import { orderedLearningChoices } from './learning-choices.js?v=1.15.2';

export function learningChoices(container, {name,values,selected,seed,group,onChange,shuffle=true}) {
  const ordered=shuffle?orderedLearningChoices(values,seed,group):values;
  container.replaceChildren(...ordered.map(([value,copy])=>{
    const label=document.createElement('label');label.className='learn-choice';
    const input=document.createElement('input');input.type='radio';input.name=name;input.value=value;input.checked=value===selected;
    const text=document.createElement('span');text.textContent=copy;label.append(input,' ',text);
    input.addEventListener('change',()=>onChange(value));return label;
  }));
}
export function learningMetric(label,value,note='') {
  const block=document.createElement('div');block.className='learn-metric';
  const title=document.createElement('span');title.className='label';title.textContent=label;
  const amount=document.createElement('strong');amount.textContent=value;
  const detail=document.createElement('span');detail.className='learn-metric-note';detail.textContent=note;
  block.append(title,' ',amount,' ',detail);return block;
}
export function learningSources(container,sources) {
  container.replaceChildren(...sources.map(source=>{
    const item=document.createElement('li'),link=document.createElement('a');
    link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=source.title+' ↗';item.append(link);return item;
  }));
}
export function learningPitfall(container,entry) {
  const title=document.createElement('strong'),copy=document.createElement('p'),link=document.createElement('a');
  title.textContent=entry.title;copy.textContent=entry.copy;
  link.href=entry.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Read the source ↗';
  container.replaceChildren(title,' ',copy,' ',link);
}
