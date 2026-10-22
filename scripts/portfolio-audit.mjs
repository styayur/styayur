// SPDX-License-Identifier: MIT
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { reviewReleases } from './portfolio-release-review.mjs';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const codeDigest = markdown => digest([...markdown.replaceAll('\r\n','\n').matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(m=>m[1]).join('\n'));
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));

// Local maintainer runs can reuse gh's existing authentication without exporting a token.
export function createGhClient() {
  const external=createClient({token:null});
  const run=promisify(execFile),cache=new Map();
  return async (url,options={})=>{
    if(!options.api)return external(url,options);
    const target=new URL(url);
    if(target.origin!=='https://api.github.com')throw Error('Refusing GitHub destination');
    if(cache.has(url))return cache.get(url);
    let result;
    for(let attempt=0;attempt<3;attempt++) {
      try {const output=await run('gh',['api','--method','GET',target.pathname+target.search],{maxBuffer:16*1024*1024});result={kind:'ok',status:200,data:JSON.parse(output.stdout)};break;}
      catch(error){const status=Number(error.stderr?.match(/HTTP (\d{3})/)?.[1]??0);result={kind:[404,410].includes(status)?'missing':'uncertain',status};if(result.kind==='missing' && attempt>0)break;}
      if(attempt<2)await delay(500*(attempt+1));
    }
    cache.set(url,result);return result;
  };
}

// Authentication is attached only to api.github.com; redirects never carry it.
export function createClient({token=process.env.GITHUB_TOKEN,fetchImpl=fetch,sleep=delay}={}) {
  const cache = new Map();
  return async function request(url,{api=false}={}) {
    const target=new URL(url);
    if (api && target.origin!=='https://api.github.com') throw Error('Refusing token destination');
    const cacheKey=`${api}:${url}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const headers={'User-Agent':'styayur-portfolio-audit','Accept':api?'application/vnd.github+json':'text/html,application/json,image/*;q=0.8,*/*;q=0.5'};
    if (api && token) headers.Authorization=`Bearer ${token}`;
    let result={kind:'uncertain',status:0};
    for (let attempt=0;attempt<3;attempt++) {
      try {
        let response=await fetchImpl(url,{headers,redirect:api?'error':'manual',signal:AbortSignal.timeout(15000)});
        if(!api) for(let redirect=0;[301,302,303,307,308].includes(response.status) && redirect<5;redirect++) {
          const next=safeLink(new URL(response.headers.get('location')??'',response.url||url).href);
          await response.body?.cancel();
          if(!next)throw Error('Refusing unsafe redirect');
          response=await fetchImpl(next,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
        }
        result={kind:response.ok?'ok':[404,410].includes(response.status)?'missing':'uncertain',status:response.status};
        if (response.ok) {
          if(api || target.pathname.endsWith('/portfolio.json'))result.data=await response.json();
          else await response.body?.cancel();
          break;
        }
        // Confirm a 404/410 in-run too, but issue creation also requires a later audit.
        if (result.kind==='missing' && attempt>0) break;
      } catch { result={kind:'uncertain',status:0}; }
      if (attempt<2) await sleep(500*(attempt+1));
    }
    cache.set(cacheKey,result);
    return result;
  };
}

export function safeLink(raw) {
  try {
    const u=new URL(raw);
    if (u.protocol!=='https:' || u.username || u.password || u.port || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|0\.|169\.254\.)/.test(u.hostname)) return null;
    if ([...u.searchParams.keys()].some(k=>/token|secret|password|auth|signature|api.?key/i.test(k))) return null;
    u.hash='';return u.href;
  } catch { return null; }
}

export function meaningfulCommit(commit) {
  const author=commit.author?.login || commit.commit?.author?.name || '';
  if (/\[bot\]|dependabot|renovate/i.test(author) || commit.parents?.length>1) return false;
  return (commit.files??[]).some(({filename:p})=> !/^(\.github|\.codeforge|docs|tests?|fixtures|examples|benchmarks?)\//i.test(p) && !/license|notice|provenance|readme|changelog/i.test(p) && /\.(rs|py|ps1|psm1|psd1|tsx?|jsx?|mjs|cjs|dart|html|css|scss|sh)$/.test(p));
}

export async function auditPortfolio(policy,{request=createClient(),now=new Date().toISOString()}={}) {
  const report={schemaVersion:1,generatedAt:now,owner:policy.owner,publicRepositories:[],findings:[],uncertain:[],releaseObservations:[],checks:{},limits:['Command blocks are fingerprinted for review; remote software is never executed.','Screenshots are checked for presence, not fabricated or regenerated.','Live provider, native device and private repository validation require separate authorized environments.']};
  const add=(repository,code,message,evidence,severity='error',details)=>report.findings.push({id:digest(`${repository}:${code}`).slice(0,20),repository,code,message,evidence,severity,details});
  const uncertain=(repository,code,status,evidence=[],details)=>report.uncertain.push({repository,code,status,evidence:evidence.length?evidence:[`https://github.com/${repository}`],details});
  const gh=async endpoint=>request('https://api.github.com'+endpoint,{api:true});
  const content=async(repo,file)=>{
    const response=await gh(`/repos/${repo}/contents/${file.split('/').map(encodeURIComponent).join('/')}`);
    if(response.kind==='ok' && response.data?.encoding==='base64') response.text=Buffer.from(response.data.content,'base64').toString('utf8');
    return response;
  };
  const repos=[];let inventoryComplete=true;
  for(let page=1;page<=100;page++) {
    const response=await gh(`/users/${policy.owner}/repos?type=owner&per_page=100&page=${page}`);
    if(response.kind!=='ok' || !Array.isArray(response.data)){uncertain(policy.owner,'public-inventory',response.status);inventoryComplete=false;break;}
    repos.push(...response.data.filter(r=>r.private===false && r.visibility==='public' && r.owner?.login.toLowerCase()===policy.owner.toLowerCase()));
    if(response.data.length<100)break;
    if(page===100)inventoryComplete=false;
  }
  report.publicRepositories=repos.map(r=>r.full_name).sort();
  const publicNames=new Set(report.publicRepositories);
  const expected=new Map(policy.repositories.map(p=>[p.repository,p]));
  if(inventoryComplete) for(const repo of repos) if(!expected.has(repo.full_name))add(repo.full_name,'new-public-repository','Review this newly public repository for portfolio inclusion.',[repo.html_url],'review');
  const external=new Map();
  const queue=async (url,repo,evidence)=>{
    const safe=safeLink(url);if(!safe)return;
    const parsed=new URL(safe);
    const own=parsed.hostname==='github.com' && parsed.pathname.split('/').filter(Boolean).length>=2 && parsed.pathname.split('/')[1]?.toLowerCase()===policy.owner.toLowerCase();
    if(own && !publicNames.has(parsed.pathname.split('/').slice(1,3).join('/'))) {
      // Never serialize a possibly private target identity into a public artifact.
      add(repo,'nonpublic-owner-link','An owner repository link is outside the public inventory; inspect it in an authorized private environment.',[evidence]);return;
    }
    if(!external.has(safe))external.set(safe,{repo,evidence});
  };
  const readmeWithoutCode=text=>text.replace(/```[\s\S]*?```/g,'');
  for(const repo of repos) {
    const name=repo.full_name,p=expected.get(name),evidence=repo.html_url+'#readme';
    if(!repo.description?.trim())add(name,'description','Repository description is missing.',[repo.html_url]);
    if(!repo.topics?.length)add(name,'topics','Repository topics are missing.',[repo.html_url]);
    if(!p)continue;
    if(repo.id!==p.repositoryId)add(name,'repository-identity','Repository identity differs from the reviewed source.',[repo.html_url]);
    if((repo.license?.spdx_id??null)!==p.licenseSpdx)add(name,'license-metadata','GitHub license metadata differs from the reviewed component policy.',[repo.html_url+'/blob/'+repo.default_branch+'/LICENSE']);
    const readme=await content(name,'README.md');
    if(readme.kind!=='ok'){
      if(readme.kind==='missing')add(name,'readme','README.md is missing.',[repo.html_url]);
      else uncertain(name,'readme',readme.status);
      continue;
    }
    if(typeof readme.text!=='string'){uncertain(name,'readme-content',readme.status);continue;}
    if(codeDigest(readme.text)!==p.readmeCodeSha256)add(name,'installation-review','Documented command blocks changed; review versions, entry points and installation behavior against current source.',[evidence],'review');
    for(const block of readme.text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
      let directory='',explicitDirectory=false;
      for(const line of block[1].split('\n')) {
        const cd=line.match(/^\s*cd\s+([\w./-]+)\s*$/);
        if(cd){const next=cd[1]===repo.name?'':cd[1].startsWith(repo.name+'/')?cd[1].slice(repo.name.length+1):cd[1];directory=path.posix.normalize(path.posix.join(directory,next));if(directory==='.')directory='';explicitDirectory=true;continue;}
        const command=line.match(/^\s*npm\s+run\s+([\w:-]+)/);
        if(command && !directory.startsWith('..')) {
          const context=explicitDirectory?directory:(p.npmDirectory??'');
          const manifestPath=context?context+'/package.json':'package.json';
          const manifest=await content(name,manifestPath);
          if(manifest.kind==='ok') {
            try {if(!Object.hasOwn(JSON.parse(manifest.text).scripts??{},command[1]))add(name,'npm-script-'+digest(manifestPath+':'+command[1]).slice(0,8),'A documented npm run command has no matching package script at its documented path.',[evidence,repo.html_url+'/blob/'+repo.default_branch+'/'+manifestPath]);}
            catch {uncertain(name,'npm-manifest-format',manifest.status);}
          } else if(manifest.kind==='missing')add(name,'npm-manifest-'+digest(manifestPath).slice(0,8),'A documented npm command points to a missing package manifest.',[evidence]);
          else uncertain(name,'npm-manifest',manifest.status);
        }
      }
    }
    for(const file of p.requiredFiles.filter(f=>f!=='README.md')) {
      const response=await content(name,file);
      if(response.kind==='missing')add(name,'required-file-'+digest(file).slice(0,8),'A reviewed license, language or contribution document is missing.',[repo.html_url+'/blob/'+repo.default_branch+'/'+file]);
      else if(response.kind!=='ok')uncertain(name,'required-file',response.status);
      else if(file==='LICENSE' && response.data.sha!==p.licenseSha)add(name,'license-text','LICENSE changed; review authority, component scope and historical grants before updating the policy.',[repo.html_url+'/blob/'+repo.default_branch+'/LICENSE'],'review');
    }
    for(const m of p.manifestLicenses) {
      const response=await content(name,m.path);
      if(response.kind==='ok') {
        try {if(JSON.parse(response.text).license!==m.license)add(name,'manifest-license-'+digest(m.path).slice(0,8),'Package license declaration differs from the reviewed component license.',[repo.html_url+'/blob/'+repo.default_branch+'/'+m.path]);}
        catch {add(name,'manifest-format','A reviewed package manifest could not be parsed.',[evidence]);}
      } else if(response.kind==='missing')add(name,'manifest-missing','A reviewed package manifest is missing.',[evidence]);
      else uncertain(name,'manifest',response.status);
    }
    if(p.visual.kind==='image') {
      const image=await content(name,p.visual.path);
      if(image.kind==='missing')add(name,'screenshot-missing','The reviewed real preview image is missing.',[evidence]);
      else if(image.kind!=='ok')uncertain(name,'screenshot',image.status);
      if(!readme.text.includes(p.visual.path))add(name,'screenshot-reference','The reviewed image is no longer referenced; review its replacement or text-only rationale.',[evidence],'review');
    }
    const workflowBadges=[...readme.text.matchAll(/https:\/\/github\.com\/([^/]+\/[^/]+)\/actions\/workflows\/([^/\s)]+)\/badge\.svg/g)];
    if(workflowBadges.length){
      const result=await gh(`/repos/${name}/actions/workflows?per_page=100`);
      if(result.kind==='ok')for(const badge of workflowBadges) {
        if(badge[1]!==name || !result.data.workflows.some(w=>w.path===`.github/workflows/${badge[2]}` && w.state==='active'))add(name,'workflow-badge-'+digest(badge[0]).slice(0,8),'A CI badge does not match an active workflow in this repository.',[evidence]);
      } else uncertain(name,'workflows',result.status);
    }
    const markdown=readmeWithoutCode(readme.text);
    for(const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
      const link=match[1];if(link.startsWith('https://'))await queue(link,name,evidence);
      else if(!/^(?:#|[a-z]+:|\/)/i.test(link)) {
        const target=decodeURIComponent(link.split(/[?#]/)[0]);
        if(target && !target.split('/').includes('..')){
          const response=await content(name,target);
          if(response.kind==='missing')add(name,'local-link-'+digest(target).slice(0,8),'A relative README link or image target is missing.',[evidence]);
          else if(response.kind!=='ok')uncertain(name,'relative-link',response.status);
        }
      }
    }
    for(const match of readme.text.matchAll(/https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/releases\/download\/([^/\s]+)\/([^\s)`"']+)/g)) {
      if(match[1]!==name)continue;
      const release=await gh(`/repos/${name}/releases/tags/${encodeURIComponent(match[2])}`);
      if(release.kind==='ok' && (release.data.draft || !release.data.assets.some(a=>a.name===decodeURIComponent(match[3]))))add(name,'install-asset-'+digest(match[0]).slice(0,8),'An explicit installer URL does not match a published release asset.',[evidence]);
      else if(release.kind==='missing')add(name,'install-release-'+digest(match[0]).slice(0,8),'An installer refers to a release tag that is not published.',[evidence]);
      else if(release.kind!=='ok')uncertain(name,'install-release',release.status);
    }
    if(repo.homepage)await queue(repo.homepage,name,repo.html_url);
  }
  const site=await request(policy.website+'/portfolio.json');
  if(site.kind==='ok' && site.data?.repositories) {
    report.websiteRegistrySha256=digest(JSON.stringify(site.data));
    const entries=site.data.repositories;
    const listed=new Set(entries.map(r=>r.repository));
    if(inventoryComplete) for(const name of publicNames)if(!listed.has(name))add(name,'website-missing','Public repository is missing from the controlled website registry.',[policy.website+'/portfolio.json']);
    // Mask unknown entries, as a stale registry must not leak non-public identities.
    if(inventoryComplete && entries.some(r=>!publicNames.has(r.repository) || r.visibility!=='public'))add(policy.owner,'website-nonpublic','Website registry includes an entry outside the public inventory; investigate privately.',[policy.website+'/portfolio.json']);
    for(const r of entries.filter(r=>publicNames.has(r.repository) && !r.excludedFromProjects)) {
      if(!r.projectSlug)add(r.repository,'website-card','A public project lacks a controlled card reference.',[policy.website+'/projects/']);
      const releases=await gh(`/repos/${r.repository}/releases?per_page=100`);
      if(releases.kind==='ok') {
        const evidence=[policy.website+'/projects/',`https://github.com/${r.repository}/releases`];
        if(Array.isArray(releases.data) && releases.data.length>=100) {
          uncertain(r.repository,'release-pagination',releases.status,evidence,{reason:'The release page reached its limit; complete pagination before comparing versions.'});
        } else {
          const review=await reviewReleases(r,releases.data,tag=>gh(`/repos/${r.repository}/releases/tags/${encodeURIComponent(tag)}`));
          report.releaseObservations.push(review.observation);
          if(review.kind==='different')add(r.repository,'website-release','Published release evidence differs from the controlled website snapshot; inspect the expected/observed tags before updating it.',evidence,'review',review.observation);
          else if(review.kind==='uncertain')uncertain(r.repository,review.code,review.status,evidence,review.observation);
        }
        if(r.releaseKind==='preview' && !r.previewRelease?.prerelease)add(r.repository,'preview-label','A preview is not explicitly marked prerelease.',[policy.website+'/portfolio.json']);
      } else uncertain(r.repository,'releases',releases.status);
      if(r.image)await queue(policy.website+r.image,r.repository,policy.website+'/projects/');
      if(r.displayReleaseUrl)await queue(r.displayReleaseUrl,r.repository,policy.website+'/projects/');
      const commits=await gh(`/repos/${r.repository}/commits?per_page=10`);
      if(commits.kind==='ok') {
        for(const c of commits.data.filter(c=>c.commit?.committer?.date?.slice(0,10)>r.substantiveUpdatedAt && c.parents?.length<=1 && !(policy.reviewedGovernanceCommits??[]).includes(c.sha) && !/\[bot\]|dependabot|renovate/i.test(c.author?.login??''))) {
          const detail=await gh(`/repos/${r.repository}/commits/${c.sha}`);
          if(detail.kind==='ok' && meaningfulCommit(detail.data)) {add(r.repository,'website-source-date','A newer substantive source change needs review against the website update date.',[policy.website+'/projects/',c.html_url],'review');break;}
          if(detail.kind!=='ok')uncertain(r.repository,'source-date',detail.status);
        }
      } else uncertain(r.repository,'source-date',commits.status);
    }
  } else uncertain(policy.owner,'website-registry',site.status);
  const links=[...external.entries()];let next=0;
  await Promise.all(Array.from({length:4},async()=>{while(next<links.length){const [url,{repo,evidence}]=links[next++];const response=await request(url);const evidenceLinks=[evidence,new URL(url).origin+new URL(url).pathname];if(response.kind==='missing')add(repo,'external-link-'+digest(url).slice(0,8),'A public README/homepage/release/preview link returned confirmed 404/410.',evidenceLinks);else if(response.kind!=='ok')uncertain(repo,'external-link-'+digest(url).slice(0,8),response.status,evidenceLinks);}}));
  report.findings=[...new Map(report.findings.map(f=>[f.id,f])).values()].sort((a,b)=>a.id.localeCompare(b.id));
  report.checks={inventoryComplete,repositories:repos.length,externalLinks:links.length,findings:report.findings.length,uncertain:report.uncertain.length};
  return report;
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const policy=JSON.parse(fs.readFileSync(new URL('../portfolio/audit-policy.json',import.meta.url),'utf8'));
  const output=process.argv.slice(2).find(arg=>!arg.startsWith('--'))??'.audit/current/report.json';
  const report=await auditPortfolio(policy,process.argv.includes('--gh')?{request:createGhClient()}:{});
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify(report.checks)+'\n');
  if(!report.checks.inventoryComplete)process.exitCode=1;
}
