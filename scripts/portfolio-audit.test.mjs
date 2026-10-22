// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { auditPortfolio, codeDigest, createClient, meaningfulCommit, safeLink } from './portfolio-audit.mjs';
import { applyNotification, marker, notificationPlan } from './portfolio-notify.mjs';

const readme='# Demo\n\n```sh\nnpm run build\n```\n';
const repo={id:1,full_name:'styayur/demo',name:'demo',private:false,visibility:'public',owner:{login:'styayur'},description:'Demo',topics:['tools'],html_url:'https://github.com/styayur/demo',default_branch:'main',license:{spdx_id:'MIT'}};
const policy={owner:'styayur',website:'https://example.org',repositories:[{repository:repo.full_name,repositoryId:1,licenseSpdx:'MIT',licenseSha:'license-sha',readmeCodeSha256:codeDigest(readme),requiredFiles:['README.md','LICENSE'],manifestLicenses:[],visual:{kind:'text'}}]};
function fixture({markdown=readme,missingReadme=false,extraRepositories=[],unknownLink=false,externalStatus}={}){
  const requests=[];
  const request=async(url)=>{
    requests.push(url);
    if(url==='https://example.org/guide')return {kind:externalStatus===404?'missing':externalStatus===503?'uncertain':'ok',status:externalStatus??200};
    if(url.includes('/users/styayur/repos?'))return {kind:'ok',status:200,data:[repo,...extraRepositories]};
    if(url.endsWith('/portfolio.json'))return {kind:'ok',status:200,data:{repositories:[{repository:repo.full_name,visibility:'public',projectSlug:'demo',releaseKind:'none',substantiveUpdatedAt:'2026-10-20'}]}};
    if(url.includes('/commits?') || url.includes('/releases?'))return {kind:'ok',status:200,data:[]};
    if(url.endsWith('/contents/README.md'))return missingReadme?{kind:'missing',status:404}:{kind:'ok',status:200,data:{encoding:'base64',content:Buffer.from(markdown+(unknownLink?'\n[Internal](https://github.com/styayur/hidden-example)':'')).toString('base64')}};
    if(url.endsWith('/contents/LICENSE'))return {kind:'ok',status:200,data:{sha:'license-sha',encoding:'base64',content:Buffer.from('MIT').toString('base64')}};
    if(url.includes('/contents/') && url.endsWith('/package.json'))return {kind:'ok',status:200,data:{encoding:'base64',content:Buffer.from(JSON.stringify({scripts:{build:'node build.mjs'}})).toString('base64')}};
    throw Error('Unexpected fixture request: '+url);
  };
  return {request,requests};
}

test('public enumeration excludes private metadata and never follows a hidden owner link',async()=>{
  const f=fixture({extraRepositories:[{...repo,id:2,full_name:'styayur/hidden-example',private:true,visibility:'private'}],unknownLink:true});
  const report=await auditPortfolio(policy,f);
  assert.deepEqual(report.publicRepositories,['styayur/demo']);
  assert.equal(report.findings.length,1);
  assert.equal(report.findings[0].code,'nonpublic-owner-link');
  assert.ok(!JSON.stringify(report).includes('hidden-example'));
  assert.ok(!f.requests.some(u=>u.includes('/repos/styayur/hidden-example')));
});

test('clean public fixture passes and missing README produces a concrete finding',async()=>{
  assert.equal((await auditPortfolio(policy,fixture())).findings.length,0);
  const report=await auditPortfolio(policy,fixture({missingReadme:true}));
  assert.equal(report.findings[0].code,'readme');
});

test('external-link workers retain public evidence and distinguish 404 from temporary errors',async()=>{
  const markdown=readme+'\n[Guide](https://example.org/guide)\n';
  const missing=await auditPortfolio(policy,fixture({markdown,externalStatus:404}));
  assert.ok(missing.findings.some(f=>f.code.startsWith('external-link-') && f.evidence.includes('https://example.org/guide')));
  const uncertain=await auditPortfolio(policy,fixture({markdown,externalStatus:503}));
  assert.ok(!uncertain.findings.some(f=>f.code.startsWith('external-link-')));
  assert.ok(uncertain.uncertain.some(f=>f.evidence.includes('https://example.org/guide')));
});

test('changed installation command blocks require review rather than executing or rewriting them',async()=>{
  const report=await auditPortfolio(policy,fixture({markdown:readme.replace('npm run build','npm run removed-script')}));
  assert.equal(report.findings.find(f=>f.code==='installation-review').severity,'review');
  assert.ok(report.findings.some(f=>f.code.startsWith('npm-script-')));
});

test('npm command paths respect reviewed prose context and cloned repository prefixes',async()=>{
  const contextual={...policy,repositories:[{...policy.repositories[0],npmDirectory:'apps/web'}]};
  const a=fixture();await auditPortfolio(contextual,a);
  assert.ok(a.requests.some(u=>u.endsWith('/contents/apps/web/package.json')));
  assert.ok(!a.requests.some(u=>u.endsWith('/contents/package.json')));
  const b=fixture({markdown:'```sh\ncd demo/apps/web\nnpm run build\n```\n'});
  await auditPortfolio(policy,b);
  assert.ok(b.requests.some(u=>u.endsWith('/contents/apps/web/package.json')));
});

test('transient responses retry, remain uncertain and never receive a token outside GitHub API',async()=>{
  const observed=[];let calls=0;
  const request=createClient({token:'test-placeholder',sleep:async()=>{},fetchImpl:async(url,options)=>{
    observed.push({url,headers:options.headers,redirect:options.redirect});calls++;
    return new Response('',{status:calls<3?503:200});
  }});
  assert.equal((await request('https://example.org')).kind,'ok');
  assert.equal(calls,3);
  assert.ok(observed.every(r=>!r.headers.Authorization));
  const fail=createClient({sleep:async()=>{},fetchImpl:async()=>new Response('',{status:503})});
  assert.equal((await fail('https://example.org')).kind,'uncertain');
  await assert.rejects(()=>request('https://example.org',{api:true}));
});

test('404 is checked twice; token-bearing API requests cannot redirect',async()=>{
  let calls=0;let options;
  const request=createClient({token:'test-placeholder',sleep:async()=>{},fetchImpl:async(_url,opts)=>{calls++;options=opts;return new Response('',{status:404});}});
  assert.equal((await request('https://api.github.com/repos/styayur/demo',{api:true})).kind,'missing');
  assert.equal(calls,2);assert.equal(options.redirect,'error');
  assert.equal(options.headers.Authorization,'Bearer test-placeholder');
});

test('public pagination continues beyond the first page',async()=>{
  let pages=0;
  const f=fixture();
  const request=async(url,options)=>{
    if(url.includes('/users/')){pages++;return {kind:'ok',status:200,data:pages===1?Array.from({length:100},()=>({...repo,private:true,visibility:'private'})):[]};}
    return f.request(url,options);
  };
  const report=await auditPortfolio({...policy,repositories:[]},{request});
  assert.equal(pages,2);assert.equal(report.publicRepositories.length,0);
});

test('local or credential-bearing links are rejected and source dates exclude docs, bots and merges',()=>{
  for(const url of ['http://example.org','https://127.0.0.1','https://10.0.0.1','https://example.org?api_key=private','https://name:password@example.org'])assert.equal(safeLink(url),null);
  const c={parents:[{}],author:{login:'styayur'},files:[{filename:'src/main.rs'}]};
  assert.equal(meaningfulCommit(c),true);
  assert.equal(meaningfulCommit({...c,files:[{filename:'docs/sample.ts'}]}),false);
  assert.equal(meaningfulCommit({...c,author:{login:'dependabot[bot]'}}),false);
  assert.equal(meaningfulCommit({...c,parents:[{},{}]}),false);
});

const finding={id:'a'.repeat(20),repository:'styayur/demo',code:'readme',message:'README missing.',evidence:['https://github.com/styayur/demo'],severity:'error'};
function report(date='2026-10-22T12:00:00Z',findings=[finding]){return {owner:'styayur',generatedAt:date,checks:{inventoryComplete:true},publicRepositories:['styayur/demo'],findings,uncertain:[]};}

test('first or rapid repeat audits cannot create an issue',()=>{
  assert.equal(notificationPlan(report(),null,[]).action,'none');
  assert.equal(notificationPlan(report(),report('2026-10-22T11:00:00Z'),[]).action,'none');
});

test('independent confirmation creates once, then updates the same issue only on changed findings',async()=>{
  const old=report('2026-10-21T12:00:00Z');
  const plan=notificationPlan(report(),old,[]);
  assert.equal(plan.action,'create');assert.ok(plan.body.includes(marker));
  const existing={number:7,state:'open',body:plan.body};
  assert.equal(notificationPlan(report(),old,[existing]).action,'none');
  const changed=report();changed.findings[0]={...finding,message:'Updated verification evidence.'};
  const update=notificationPlan(changed,old,[existing]);
  assert.equal(update.action,'update');assert.equal(update.number,7);
  const writes=[];
  await applyNotification(update,{request:async(...args)=>writes.push(args)});
  assert.equal(writes[0][0],'PATCH');assert.equal(writes[0][1],'/repos/styayur/styayur/issues/7');
});

test('two independent clean audits close the tracking issue; uncertainty keeps it open',()=>{
  const issue={number:7,state:'open',body:marker};
  const current=report(undefined,[]),previous=report('2026-10-21T12:00:00Z',[]);
  assert.equal(notificationPlan(current,previous,[issue]).action,'close');
  current.uncertain.push({code:'network'});
  assert.equal(notificationPlan(current,previous,[issue]).action,'none');
});

test('a nonpublic confirmed target is refused before any issue write',()=>{
  const current=report(),previous=report('2026-10-21T12:00:00Z');
  current.findings=[{...finding,repository:'styayur/hidden-example'}];
  assert.throws(()=>notificationPlan(current,previous,[]));
});
