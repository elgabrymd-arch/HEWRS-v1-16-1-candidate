"""Exact V3-only reviewed-panel transformation; historical delivery stays intact."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULES = ('data/issue22-reviewed-overlay.js', 'src/issue22-reviewed-data.js')
SOURCE = 'src/reviewed-rejection-integration.js'


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError('Issue 22 reviewed panel anchor changed: '+old[:100])
    return source.replace(old, new)


def panel(source=None):
    """Return the complete source for a content-addressed V3 reviewed panel."""
    code = (ROOT/SOURCE).read_text() if source is None else source
    code = replace_once(code, 'n.onload=resolve;',
                        'n.onload=()=>{try{root.HEWRSIssue22Reviewed.installedModule(url);resolve();}catch(error){reject(error);}};')
    code = replace_once(code, 'data=await r.json();',
                        'data=await root.HEWRSIssue22Reviewed.reviewData(await r.json());')
    code = replace_once(code, 'const features=await r.json();',
                        'const features=await root.HEWRSIssue22Reviewed.discoveryFeatures(await r.json());')
    code = replace_once(code, "el('small',detail||", "el('small',root.HEWRSIssue22Reviewed.label(e)||detail||")
    code = replace_once(code, "unreviewed=e.kind==='unreviewed_possibility',diagnostic=",
                        "unreviewed=e.kind==='unreviewed_possibility',stale=root.HEWRSIssue22Reviewed.isHistoricalEntry(e),diagnostic=")
    code = replace_once(code, "$('rd-tier').textContent=unreviewed?",
                        "$('rd-tier').textContent=stale?'Appearance changed — the stored review is historical; reassessment is required':unreviewed?")
    code = replace_once(code, "$('rd-board').hidden=unreviewed;$('rd-component-cards').hidden=!unreviewed;",
                        "$('rd-board').hidden=unreviewed||stale;$('rd-component-cards').hidden=!(unreviewed||stale);")
    code = replace_once(code, "}else{$('rd-board').src=extraImages.get(id)",
                        "}else if(stale){root.HEWRSOptionCards.create(app.connection).mount($('rd-component-cards'),root.HEWRSOptionCards.create(app.connection).model(s));$('rd-reason').textContent='Historical judgment, before the garment correction: '+e.review.reason;$('rd-counter').textContent='The earlier image board and assessment do not validate the corrected appearance. A new whole-outfit review is required.';}else{$('rd-board').src=extraImages.get(id)")
    prefix = ''.join('/* V3 ISSUE 22 REVIEWED SOURCE: '+name+' */\n'+(ROOT/name).read_text()+'\n;\n' for name in MODULES)
    return prefix+'/* V3 ISSUE 22 REVIEWED PANEL: '+SOURCE+' */\n'+code


if __name__ == '__main__':
    print('ISSUE22_REVIEWED_PANEL_BYTES='+str(len(panel().encode())))
