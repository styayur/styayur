// SPDX-License-Identifier: MIT
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest, safeLink } from './portfolio-audit.mjs';

export const marker='<!-- portfolio-audit:v1 -->';
export function notificationPlan(current,previous,issues,{runUrl}={}) {
  if(current.owner!=='styayur' || !current.checks?.inventoryComplete) throw Error('Incomplete public audit');
  const open=issues.filter(i=>!i.pull_request && i.state==='open' && i.body?.includes(marker)).sort((a,b)=>a.number-b.number)[0];
  const age=Date.parse(current.generatedAt)-Date.parse(previous?.generatedAt);
  if(previous?.owner!==current.owner || !previous?.checks?.inventoryComplete || !(age>=6*3600000 && age<=21*86400000))return {action:'none',reason:'A separate successful public audit at least six hours earlier is required.'};
  const oldIds=new Set(previous.findings.map(f=>f.id));
  const publicNames=new Set(current.publicRepositories);
  const confirmed=current.findings.filter(f=>oldIds.has(f.id));
  for(const f of confirmed) {
    if(f.repository!==current.owner && !publicNames.has(f.repository))throw Error('Refusing non-public finding');
    if(!/^[a-f0-9]{20}$/.test(f.id) || !/^[a-z0-9-]+$/.test(f.code))throw Error('Invalid finding');
    for(const link of f.evidence)if(!safeLink(link))throw Error('Unsafe evidence URL');
  }
  if(!confirmed.length){
    const clean=!current.findings.length && !previous.findings.length && !current.uncertain.length && !previous.uncertain.length;
    return open && clean?{action:'close',number:open.number,reason:'Two independent clean audits with no uncertain checks.'}:{action:'none',reason:'No independently confirmed findings.'};
  }
  const fingerprint=digest(JSON.stringify(confirmed));
  if(open?.body?.includes(`<!-- fingerprint:${fingerprint} -->`))return {action:'none',reason:'Unchanged findings are already tracked.',number:open.number};
  const lines=confirmed.slice(0,100).map(f=>`- **${f.repository} / ${f.code}** (${f.severity}): ${f.message}\n  ${f.evidence.map((u,i)=>`[Evidence ${i+1}](${u})`).join(' · ')}`);
  const body=[marker,`<!-- fingerprint:${fingerprint} -->`,'# Confirmed public portfolio findings','These findings appeared in two successful audits at least six hours apart. Review the linked evidence before changing any source, license or website data.',...lines,`Uncertain checks in this run: ${current.uncertain.length}. They are excluded from confirmed defects.`,runUrl?`[Current audit artifact and logs](${runUrl})`:'','This workflow does not rewrite documents, inspect private repositories or create one issue per link.'].filter(Boolean).join('\n\n')+'\n';
  return {action:open?'update':'create',number:open?.number,title:'[Portfolio audit] Confirmed public findings',body};
}

export async function applyNotification(plan,{request}) {
  if(plan.action==='none')return {action:'none',reason:plan.reason};
  const root='/repos/styayur/styayur/issues';
  if(plan.action==='create')return request('POST',root,{title:plan.title,body:plan.body});
  if(plan.action==='update')return request('PATCH',`${root}/${plan.number}`,{body:plan.body});
  return request('PATCH',`${root}/${plan.number}`,{state:'closed',state_reason:'completed'});
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const current=JSON.parse(fs.readFileSync(process.argv[2]??'.audit/current/report.json','utf8'));
  const previousFile=process.argv[3]??'.audit/previous/report.json';
  const previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile,'utf8')):null;
  const token=process.env.GITHUB_TOKEN;
  if(!token)throw Error('Notification requires the repository-scoped Actions token.');
  const request=async(method,endpoint,data)=>{
    if(!endpoint.startsWith('/repos/styayur/styayur/issues'))throw Error('Refusing issue destination');
    const response=await fetch('https://api.github.com'+endpoint,{method,redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'styayur-portfolio-audit'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`Issue API failed (${response.status}); no automatic retry of writes.`);
    return response.json();
  };
  const issues=[];
  for(let page=1;page<=100;page++){
    const batch=await request('GET',`/repos/styayur/styayur/issues?state=open&per_page=100&page=${page}`);
    issues.push(...batch);if(batch.length<100)break;
    if(page===100)throw Error('Issue pagination incomplete; refusing duplicate creation.');
  }
  const runUrl=process.env.GITHUB_RUN_ID?`https://github.com/styayur/styayur/actions/runs/${process.env.GITHUB_RUN_ID}`:undefined;
  const plan=notificationPlan(current,previous,issues,{runUrl});
  const result=await applyNotification(plan,{request});
  console.log(JSON.stringify({action:plan.action,reason:plan.reason,number:result.number??plan.number}));
}
