import { MANAGEMENT_IDS, MANAGEMENT_VARIANTS } from '../models/range-decisions.js?v=1.15.0';
import { validChoiceSeed } from '../lib/learning-choices.js?v=1.15.0';
export const MANAGEMENT_KEY = 'passiko-range-learning-v1';
export const emptyManagementProgress = () => ({version:1,completed:[],drafts:{}});
export function parseManagementProgress(value) {
  const clean=emptyManagementProgress();
  if(value?.version!==1)return clean;
  clean.completed=MANAGEMENT_IDS.filter(id=>Array.isArray(value.completed)&&value.completed.includes(id));
  for(const id of MANAGEMENT_IDS) {
    const draft=value.drafts?.[id];
    if(!draft||!Number.isInteger(draft.variant)||draft.variant<0||draft.variant>=MANAGEMENT_VARIANTS)continue;
    const short=key=>typeof draft[key]==='string'&&draft[key].length<=24?draft[key]:'';
    clean.drafts[id]={variant:draft.variant,prediction:short('prediction'),reason:short('reason'),application:short('application'),revealed:draft.revealed===true,choiceSeed:validChoiceSeed(draft.choiceSeed)?draft.choiceSeed:null};
  }
  return clean;
}
export function readManagementProgress(getStorage=()=>globalThis.localStorage) {
  try {const raw=getStorage().getItem(MANAGEMENT_KEY);return {progress:raw?parseManagementProgress(JSON.parse(raw)):emptyManagementProgress(),available:true};}
  catch {return {progress:emptyManagementProgress(),available:false};}
}
export function saveManagementProgress(progress,getStorage=()=>globalThis.localStorage) {
  try{getStorage().setItem(MANAGEMENT_KEY,JSON.stringify(parseManagementProgress(progress)));return true;}catch{return false;}
}
