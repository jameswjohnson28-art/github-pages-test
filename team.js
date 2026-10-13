import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabase=createClient('https://hdqqpggjrjomnhogrlhq.supabase.co','sb_publishable_JxlklIfK-0O1-9SP2JVnvQ_VfeNqImG');
const role=document.body.dataset.role;
let me=null;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>value?new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'—';
const full=value=>value?new Date(value).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):'—';
const shift=(start,end)=>time(start)+(end?' – '+time(end):' – active');
window.showPage=id=>{document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.id===id));document.querySelectorAll('.navlink').forEach(button=>button.classList.toggle('active',button.dataset.page===id));location.hash=id};
window.signOut=async()=>{await supabase.auth.signOut();location.href='index.html'};

async function boot(){
 try{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.user){location.href='index.html';return}
  me=session.user;
  const {data:profile,error}=await supabase.from('profiles').select('*').eq('id',me.id).single();
  if(error||!profile)throw new Error('Profile unavailable');
  if(profile.role!==role){location.href=({owner:'owner.html',team_lead:'team-lead.html',staff:'staff.html'}[profile.role]||'index.html');return}
  document.getElementById('whoName').textContent=profile.display_name||profile.username||me.email;
  document.getElementById('whoRole').textContent=profile.role.replace('_',' ');
  const title=document.getElementById('portalTitle');if(title)title.textContent=role==='owner'?'Command table':role==='team_lead'?'Lead operations':'Staff operations';
  const work=[loadClock(),loadDocuments()];
  if(role!=='staff')work.push(loadTeam());
  if(role==='owner'){work.push(loadRoadmap(),loadRoster());setupUploader()}
  await Promise.allSettled(work);
  const destination=location.hash.slice(1);
  window.showPage(document.getElementById(destination)?destination:'home');
 }catch(error){
  console.error(error);
  document.getElementById('whoName').textContent='Portal unavailable';
  document.getElementById('whoRole').textContent='Please return to the customer site and sign in again.';
 }
}
async function loadClock(){
 const {data=[]}=await supabase.from('time_entries').select('*').eq('user_id',me.id).order('clock_in',{ascending:false});
 const open=data.find(entry=>!entry.clock_out);
 document.querySelectorAll('[id="clockState"]').forEach(el=>el.innerHTML=open?'<span class="badge good">Clocked in since '+full(open.clock_in)+'</span>':'<span class="badge warn">Off the clock</span>');
 document.querySelectorAll('[id="clockAction"]').forEach(el=>el.textContent=open?'Clock out':'Clock in');
 window.toggleClock=async()=>{
  const {error}=await supabase.rpc(open?'clock_out':'clock_in');
  document.querySelectorAll('[id="clockStatus"]').forEach(el=>el.textContent=error?error.message:(open?'You are clocked out. Shift saved.':'You are clocked in.'));
  await loadClock();
 };
 const mine=document.getElementById('myHours');
 if(mine)mine.innerHTML=data.slice(0,8).map(entry=>'<div class="row"><div><b>'+full(entry.clock_in)+'</b><small>'+shift(entry.clock_in,entry.clock_out)+'</small></div><span class="badge">'+escapeHtml(entry.notes||'Shift')+'</span></div>').join('')||'<div class="empty">No time entries yet.</div>';
}
async function loadDocuments(){
 const target=document.getElementById('documents');if(!target)return;
 const {data,error}=await supabase.from('documents').select('*').order('created_at',{ascending:false});
 target.innerHTML=error?'<div class="empty">Documents are not available yet.</div>':(data||[]).map(doc=>'<div class="row"><div><b>'+escapeHtml(doc.title)+'</b><small>'+escapeHtml(doc.category)+'</small></div><a class="btn alt" href="'+escapeHtml(doc.url)+'" target="_blank" rel="noopener">Open</a></div>').join('')||'<div class="empty">No documents have been posted yet.</div>';
}
async function loadTeam(){
 const target=document.getElementById('teamTable');if(!target)return;
 const [{data:entries,error},{data:people}]=await Promise.all([supabase.from('time_entries').select('id,user_id,clock_in,clock_out,notes').order('clock_in',{ascending:false}).limit(30),supabase.from('profiles').select('id,username,display_name,email')]);
 if(error){target.innerHTML='<div class="empty">Time records are unavailable.</div>';return}
 const names=Object.fromEntries((people||[]).map(person=>[person.id,person.display_name||person.username||person.email]));
 target.innerHTML='<table class="table"><thead><tr><th>Member</th><th>Date</th><th>Shift</th><th>Note</th><th></th></tr></thead><tbody>'+(entries||[]).map(entry=>'<tr><td>'+escapeHtml(names[entry.user_id]||'Guild member')+'</td><td>'+new Date(entry.clock_in).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})+'</td><td><b>'+shift(entry.clock_in,entry.clock_out)+'</b></td><td>'+escapeHtml(entry.notes||'—')+'</td><td><button class="btn alt" data-edit="'+entry.id+'">Edit</button></td></tr>').join('')+'</tbody></table>';
 target.querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',()=>{const entry=(entries||[]).find(item=>item.id===button.dataset.edit);openTimeEditor(entry)}));
}
function options(values,selected){return values.map(value=>'<option value="'+value+'" '+(String(value)===String(selected)?'selected':'')+'>'+String(value).padStart(2,'0')+'</option>').join('')}
function openTimeEditor(entry){
 const modal=document.createElement('div');modal.className='modal-editor';
 const start=new Date(entry.clock_in), end=new Date(entry.clock_out||entry.clock_in);
 const date=start.getFullYear()+'-'+String(start.getMonth()+1).padStart(2,'0')+'-'+String(start.getDate()).padStart(2,'0');
 const controls=(prefix,value)=>{let hour=value.getHours()%12||12,minute=value.getMinutes(),period=value.getHours()>=12?'PM':'AM';return '<div class="formgrid"><select class="select" id="'+prefix+'Hour">'+options([1,2,3,4,5,6,7,8,9,10,11,12],hour)+'</select><select class="select" id="'+prefix+'Minute">'+options(Array.from({length:60},(_,i)=>i),minute)+'</select><select class="select" id="'+prefix+'Period"><option '+(period==='AM'?'selected':'')+'>AM</option><option '+(period==='PM'?'selected':'')+'>PM</option></select></div>'};
 modal.innerHTML='<div class="editor-card"><div class="eyebrow">Time sheet entry</div><h2>Edit shift</h2><label>Date<input id="editDate" type="date" class="field" value="'+date+'"></label><label>Clock in</label>'+controls('in',start)+'<label>Clock out</label>'+controls('out',end)+'<label>Note<input id="editNote" class="field" maxlength="500" value="'+escapeHtml(entry.notes||'')+'"></label><div class="tools"><button class="btn" id="saveTime">Save changes</button><button class="btn alt" id="cancelTime">Cancel</button></div><div class="status" id="editStatus"></div></div>';
 document.body.append(modal);
 modal.querySelector('#cancelTime').onclick=()=>modal.remove();
 modal.querySelector('#saveTime').onclick=async()=>{
  const build=prefix=>{let hour=Number(modal.querySelector('#'+prefix+'Hour').value),minute=Number(modal.querySelector('#'+prefix+'Minute').value),period=modal.querySelector('#'+prefix+'Period').value;if(period==='PM'&&hour!==12)hour+=12;if(period==='AM'&&hour===12)hour=0;return new Date(modal.querySelector('#editDate').value+'T'+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')+':00').toISOString()};
  const {error}=await supabase.rpc('manager_update_time',{entry_id:entry.id,new_clock_in:build('in'),new_clock_out:build('out'),new_notes:modal.querySelector('#editNote').value});
  if(error){modal.querySelector('#editStatus').textContent=error.message;return}
  modal.remove();await loadTeam();
 };
}
function setupUploader(){
 const input=document.getElementById('documentUpload');if(!input)return;
 input.addEventListener('change',async()=>{
  const file=input.files?.[0];if(!file)return;
  if(file.size>15*1024*1024){alert('Please keep documents under 15 MB.');input.value='';return}
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=me.id+'/'+Date.now()+'-'+safeName;
  const {error:uploadError}=await supabase.storage.from('guild-documents').upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError){alert(uploadError.message);input.value='';return}
  const {data:urlData}=supabase.storage.from('guild-documents').getPublicUrl(path);
  const {error:recordError}=await supabase.from('documents').insert({title:file.name,url:urlData.publicUrl,category:'Uploaded document'});
  if(recordError){alert(recordError.message);input.value='';return}
  input.value='';await loadDocuments();alert('Document uploaded and shared with staff.');
 });
}

async function loadRoster(){
 const target=document.getElementById('roster');if(!target)return;
 const {data=[]}=await supabase.from('profiles').select('id,email,username,display_name,role').order('created_at');
 target.innerHTML=data.map(person=>'<div class="row"><div><b>'+escapeHtml(person.display_name||person.username||person.email)+'</b><small>'+escapeHtml(person.email)+'</small></div><div class="tools"><select class="select" id="role-'+person.id+'">'+['customer','staff','team_lead','owner'].map(item=>'<option value="'+item+'" '+(person.role===item?'selected':'')+'>'+item.replace('_',' ')+'</option>').join('')+'</select><button class="btn alt" data-role="'+person.id+'">Save</button></div></div>').join('');
 target.querySelectorAll('[data-role]').forEach(button=>button.addEventListener('click',async()=>{const {error}=await supabase.rpc('assign_role',{target_user:button.dataset.role,new_role:document.getElementById('role-'+button.dataset.role).value});if(error)alert(error.message);else await loadRoster()}));
}
async function loadRoadmap(){
 const target=document.getElementById('roadmapAdmin');if(!target)return;
 const {data=[]}=await supabase.from('roadmap_items').select('*').order('sort_order');
 target.innerHTML=data.map(item=>'<div class="row"><div><b>'+escapeHtml(item.title)+'</b><small>'+escapeHtml(item.phase)+' · '+escapeHtml(item.status)+'<br>'+escapeHtml(item.details)+'</small></div><div class="tools"><button class="btn alt" data-road="'+item.id+'">Edit</button></div></div>').join('')||'<div class="empty">No roadmap items.</div>';
 target.querySelectorAll('[data-road]').forEach(button=>button.addEventListener('click',()=>alert('Roadmap editing is available from the current owner tools.')));
}
boot();