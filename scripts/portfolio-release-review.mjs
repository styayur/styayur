// SPDX-License-Identifier: MIT
const published = release => release?.draft === false &&
  typeof release.prerelease === 'boolean' && typeof release.tag_name === 'string' &&
  release.tag_name.length > 0 && typeof release.published_at === 'string' &&
  Number.isFinite(Date.parse(release.published_at));

const brief = release => release ? {
  tag: release.tag_name, publishedAt: release.published_at, prerelease: release.prerelease,
} : null;

// A list response that omits a newer, independently retrievable known tag is
// inconsistent evidence, not proof that the controlled website is outdated.
export async function reviewReleases(record, list, lookup) {
  const observation={repository:record.repository,expectedFormal:record.formalRelease?.tag??null,expectedPreview:record.previewRelease?.tag??null};
  if(!Array.isArray(list) || list.some(r=>typeof r?.draft!=='boolean' || (!r.draft && !published(r)))) {
    return {kind:'uncertain',code:'release-schema',status:200,observation:{...observation,reason:'Published release payload lacks the documented tag/date/boolean fields.',sampleFieldNames:Array.isArray(list)?Object.keys(list.find(r=>r?.draft!==true)??{}).slice(0,30):[]}};
  }
  const ordered=list.filter(published).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
  const formal=ordered.find(r=>!r.prerelease),preview=ordered.find(r=>r.prerelease);
  Object.assign(observation,{observedFormal:brief(formal),observedPreview:brief(preview)});
  const different=(formal?.tag_name??null)!==observation.expectedFormal || (!formal && (preview?.tag_name??null)!==observation.expectedPreview);
  if(!different)return {kind:'same',observation};

  const expected=record.formalRelease??(!formal?record.previewRelease:null);
  if(expected?.tag) {
    const confirmed=await lookup(expected.tag);
    if(confirmed.kind==='uncertain')return {kind:'uncertain',code:'release-confirmation',status:confirmed.status,observation};
    if(confirmed.kind==='ok') {
      if(!published(confirmed.data) && confirmed.data?.draft!==true)return {kind:'uncertain',code:'release-schema',status:confirmed.status,observation};
      const expectedIsFormal=Boolean(record.formalRelease);
      if(published(confirmed.data) && confirmed.data.prerelease===!expectedIsFormal) {
        observation.confirmedKnownTag=brief(confirmed.data);
        const candidate=expectedIsFormal?formal:preview;
        if(!candidate || Date.parse(confirmed.data.published_at)>Date.parse(candidate.published_at)) {
          return {kind:'uncertain',code:'release-list-stale',status:confirmed.status,observation};
        }
      }
    }
  }
  return {kind:'different',observation};
}
