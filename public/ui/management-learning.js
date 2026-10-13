import { MANAGEMENT_CHAPTER, MANAGEMENT_LESSONS, managementPresentation } from '../learning/choosing-ranges.js?v=1.14.0';
import { MANAGEMENT_IDS, MANAGEMENT_VARIANTS, managementCase, checkManagementUnderstanding } from '../models/range-decisions.js?v=1.14.0';
import { managementLessonFromHash } from '../lib/management-links.js?v=1.14.0';
import { readManagementProgress, saveManagementProgress } from '../data/management-progress.js?v=1.14.0';
import { newChoiceSeed, validChoiceSeed } from '../lib/learning-choices.js?v=1.14.0';
import { learningChoices, learningMetric, learningSources } from '../lib/learning-elements.js?v=1.14.0';
import { rangeHash } from '../lib/range-links.js';

export function initManagementLearning() {
  const $=id=>document.getElementById(id), {progress}=readManagementProgress();
  let lesson, draft, outcome, presentation;
  const fresh=(variant=0)=>({variant,prediction:'',reason:'',application:'',revealed:false,choiceSeed:newChoiceSeed()});
  function focus(id) {$(id).focus({preventScroll:true});$(id).scrollIntoView({block:'start',behavior:'instant'});}
  function navigation() {
    $('manage-progress-count').textContent=progress.completed.length+' of 3 checked';
    for(const link of document.querySelectorAll('[data-management-id]')) {
      const id=link.dataset.managementId, active=id===managementLessonFromHash(location.hash), complete=progress.completed.includes(id);
      link.setAttribute('aria-current',active?'step':'false');link.classList.toggle('learn-step-done',complete);
      link.querySelector('.learn-step-state').textContent=complete?'Checked':active?'Now exploring':'Open exercise';
    }
  }
  function persist() {
    progress.drafts[lesson.id]=draft;
    const available=saveManagementProgress(progress);
    $('learn-storage').textContent=available?'Progress saved in this browser.':'Saving is unavailable. You can keep learning in this tab.';
    $('learn-resume').textContent=(draft.prediction||draft.revealed?'Continue: ':'Start: ')+lesson.short+' ↓';navigation();
  }
  function clearFeedback() {$('manage-feedback').hidden=true;$('manage-continue').hidden=true;}
  function choices(id,name,values,selected,onChange) {
    learningChoices($(id),{name,values,selected,seed:draft.choiceSeed,group:lesson.id+name,onChange,shuffle:name!=='manage-prediction'});
  }
  function reveal() {
    if(!draft.prediction)return;
    draft.revealed=true;
    $('manage-prediction-feedback').textContent=draft.prediction===outcome.prediction?'Your prediction matches this example.':'The example differs from your prediction: '+presentation.predictions.find(([id])=>id===outcome.prediction)[1]+'. Compare it with your prediction.';
    $('manage-metrics').replaceChildren(...presentation.metrics.map(items=>learningMetric(...items)));
    $('manage-explanation').textContent=lesson.explanation;$('manage-takeaway').textContent=lesson.takeaway;$('manage-pitfall').textContent=lesson.pitfall;
    $('manage-handoffs').replaceChildren(...presentation.links.map(({label,scenario})=>{
      const link=document.createElement('a');const home=new URL('./',location.href);home.hash=rangeHash(scenario);
      link.href=home.href;link.textContent=label;link.target='_blank';link.rel='noopener noreferrer';return link;
    }));
    $('manage-explore-note').textContent=presentation.note;
    $('manage-observe').hidden=false;$('manage-assessment').hidden=false;$('manage-reveal').textContent='Revisit the example ↓';persist();
  }
  function check(save=true) {
    const result=checkManagementUnderstanding(lesson.id,draft.variant,draft.reason,draft.application);
    $('manage-feedback').hidden=false;$('manage-feedback').className='learn-feedback '+(result.passed?'learn-pass':'learn-retry');
    $('manage-feedback-title').textContent=result.passed?'Both answers are correct.':'Review your answers.';
    const reasonFeedback=lesson.reasonFeedback[draft.reason]||'Choose an explanation for the example. '+lesson.hint;
    const applicationFeedback=draft.application?lesson.applicationFeedback:'Choose an answer for the changed situation. '+lesson.applicationHint;
    $('manage-feedback-copy').textContent=result.passed?lesson.takeaway:!result.reasoning&&!result.application?reasonFeedback+' '+applicationFeedback:!result.reasoning?'Your application fits the changed situation. '+reasonFeedback:'Your explanation fits the example. '+applicationFeedback;
    $('manage-continue').hidden=!result.passed;
    if(result.passed&&!progress.completed.includes(lesson.id))progress.completed.push(lesson.id);
    const next=MANAGEMENT_LESSONS[MANAGEMENT_IDS.indexOf(lesson.id)+1];
    $('manage-next').href=next?'#manage='+next.id:'#applied=fees-over-time';
    $('manage-next').textContent=next?'Next: '+next.short+' →':'Next: Fees, time and range exits →';
    if(save)persist();else navigation();
  }
  function activate(scroll=false) {
    const id=managementLessonFromHash(location.hash);$('learn-management').hidden=!id;navigation();if(!id)return;
    lesson=MANAGEMENT_LESSONS.find(item=>item.id===id);draft=progress.drafts[id]||fresh();
    if(!validChoiceSeed(draft.choiceSeed))draft.choiceSeed=newChoiceSeed();
    outcome=managementCase(id,draft.variant);presentation=managementPresentation(outcome);
    if(!presentation.predictions.some(([value])=>value===draft.prediction)){draft.prediction='';draft.revealed=false;}
    if(!lesson.reasons.some(([value])=>value===draft.reason))draft.reason='';
    if(!lesson.applications.some(([value])=>value===draft.application))draft.application='';
    $('learn-page-title').textContent=MANAGEMENT_CHAPTER;$('learn-page-subtitle').textContent='Three practical situations after the essentials. All values are supplied; explain what they mean.';
    document.title=lesson.short+' · Passiko Learn';$('learn-route-note').hidden=true;
    $('manage-number').textContent='RANGE CHOICES '+(MANAGEMENT_IDS.indexOf(id)+1)+' OF 3';$('manage-title').textContent=lesson.title;
    $('manage-adds').textContent=lesson.adds;$('manage-intro').textContent=lesson.intro;$('manage-setup').textContent=presentation.setup;
    $('manage-prediction-question').textContent=presentation.prediction;$('manage-variation-label').textContent='Situation '+(draft.variant+1)+' of '+MANAGEMENT_VARIANTS;
    $('manage-reason-question').textContent=presentation.reasoning||lesson.reasoning;$('manage-application-context').textContent=lesson.applicationContext;$('manage-application-question').textContent=lesson.applicationQuestion;
    $('manage-hint-text').textContent=lesson.hint+' '+lesson.applicationHint;$('manage-hint').open=false;$('manage-deeper').open=false;
    $('manage-deeper-copy').replaceChildren(...lesson.deeper.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
    learningSources($('manage-sources'),lesson.sources);
    $('manage-observe').hidden=true;$('manage-assessment').hidden=true;clearFeedback();
    $('manage-reveal').disabled=!draft.prediction;$('manage-reveal').textContent='Reveal the example →';
    choices('manage-predictions','manage-prediction',presentation.predictions,draft.prediction,value=>{
      draft.prediction=value;draft.revealed=false;draft.reason='';draft.application='';
      $('manage-observe').hidden=true;$('manage-assessment').hidden=true;clearFeedback();
      document.querySelectorAll('input[name="manage-reason"],input[name="manage-application"]').forEach(input=>{input.checked=false;});
      $('manage-reveal').disabled=false;$('manage-reveal').textContent='Reveal the example →';persist();
    });
    choices('manage-reasons','manage-reason',lesson.reasons,draft.reason,value=>{draft.reason=value;clearFeedback();persist();});
    choices('manage-applications','manage-application',lesson.applications,draft.application,value=>{draft.application=value;clearFeedback();persist();});
    if(draft.revealed){reveal();if(checkManagementUnderstanding(id,draft.variant,draft.reason,draft.application).passed)check(false);}
    persist();
    if(!matchMedia('(max-width: 750px)').matches){
      const sidebar=document.querySelector('.learn-sidebar'),selected=document.querySelector('[data-management-id="'+id+'"]');
      const bounds=selected.getBoundingClientRect(),visible=sidebar.getBoundingClientRect();
      if(bounds.bottom>visible.bottom)sidebar.scrollTop+=bounds.bottom-visible.bottom+24;
      else if(bounds.top<visible.top)sidebar.scrollTop+=bounds.top-visible.top-24;
    }
    if(scroll)focus('manage-title');
  }
  MANAGEMENT_LESSONS.forEach((item,index)=>{
    const li=document.createElement('li'),link=document.createElement('a');link.href='#manage='+item.id;link.dataset.managementId=item.id;
    const number=document.createElement('span');number.className='learn-step-number';number.textContent=String(index+1).padStart(2,'0');
    const copy=document.createElement('span');copy.className='learn-step-copy';
    const title=document.createElement('strong');title.textContent=item.short;const state=document.createElement('span');state.className='learn-step-state';
    copy.append(title,' ',state);link.append(number,' ',copy);li.append(link);$('manage-lesson-list').append(li);
    link.addEventListener('click',()=>{if(matchMedia('(max-width: 750px)').matches)$('learn-course').open=false;});
  });
  $('manage-reveal').addEventListener('click',()=>{reveal();focus('manage-observe-title');});
  $('manage-assessment-form').addEventListener('submit',event=>{event.preventDefault();if(draft?.revealed)check();});
  const nextVariation=()=>{progress.drafts[lesson.id]=fresh((draft.variant+1)%MANAGEMENT_VARIANTS);activate(true);};
  $('manage-variation').addEventListener('click',nextVariation);$('manage-fresh').addEventListener('click',nextVariation);
  $('manage-topics').addEventListener('click',()=>{$('learn-course').open=true;const summary=$('learn-course').querySelector('summary');summary.focus({preventScroll:true});$('learn-course').scrollIntoView({block:'start',behavior:'instant'});});
  $('learn-resume').addEventListener('click',()=>{if(managementLessonFromHash(location.hash))focus('manage-title');});
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest('a[href^="#manage="]');
    if(link&&link.hash===location.hash&&managementLessonFromHash(link.hash)){event.preventDefault();focus('manage-title');}
  });
  window.addEventListener('hashchange',()=>activate(true));activate();
}
