#! /bin/bash
# list issues that got the label "ready" after the date of a tag as markdown
usage() {
  cat <<EOF
usage: $0 [-s] [-c comment] [-t] [-m model] [-p promptfile] [-l label] [-r repo] tag
  list all issues that got the label (default: ready) assigned after the date of tag
  -s        silent: no progress info on stderr
  -c comment  instead of the markdown list output a gh command per issue that closes it
            with this comment (markdown allowed); no titles, no translation
  -t        translate the titles to german with gemini (one request, needs GEMINI_API_KEY
            and python google-genai, uses newDoc/translate/main.py)
  -m model  gemini model for -t (default: gemini-3.1-flash-lite)
  -p file   markdown file with translation instructions
            (default: newDoc/translate/issue-titles-prompt.md)
  -l label  use another label
  -r repo   alternate repository (owner/name or https://github.com/owner/name),
            default: the repository of the current directory
EOF
  exit 1
}
label=ready
translate=0
silent=0
ccomment=
repo=
model=gemini-3.1-flash-lite
scriptdir=$(cd "$(dirname "$0")" && pwd)
tdir="$scriptdir/../newDoc/translate"
prompt="$tdir/issue-titles-prompt.md"
while getopts "sc:tm:p:l:r:" opt; do
  case $opt in
    s) silent=1;;
    c) ccomment="$OPTARG";;
    t) translate=1;;
    m) model="$OPTARG";;
    p) prompt="$OPTARG";;
    l) label="$OPTARG";;
    r) repo="$OPTARG";;
    *) usage;;
  esac
done
shift $((OPTIND-1))
tag="$1"
[ -z "$tag" ] && usage
[ -n "$ccomment" ] && translate=0
log() { [ $silent = 1 ] || echo "$@" >&2; }
for c in gh jq git; do
  command -v $c >/dev/null || { echo "$c not found" >&2; exit 1; }
done
if [ $translate = 1 ] ; then
  [ -f "$prompt" ] || { echo "prompt file $prompt not found" >&2; exit 1; }
  [ -n "$GEMINI_API_KEY" ] || { echo "GEMINI_API_KEY not set" >&2; exit 1; }
fi
if [ -n "$repo" ] ; then
  repo=${repo#*github.com/}
  repo=${repo%/}
  repo=${repo%.git}
  since=$(gh api "repos/$repo/commits/$tag" --jq .commit.committer.date 2>/dev/null)
else
  since=$(git log -1 --format=%cI "$tag^{commit}" 2>/dev/null)
  repo=$(gh repo view --json nameWithOwner -q .nameWithOwner) || exit 1
fi
if [ -z "$since" ] ; then
  echo "tag $tag not found" >&2
  exit 1
fi
since=$(date -u -d "$since" '+%Y-%m-%dT%H:%M:%SZ')
log "issues labeled \"$label\" in $repo since $tag ($since)"

# candidates: issues that have (or had) the label and were updated since the tag
numbers=$(gh api --paginate "repos/$repo/issues?state=all&labels=$label&since=$since&per_page=100" \
  --jq '.[] | select(.pull_request == null) | .number' | sort -n -u)
log "found $(echo $numbers | wc -w) candidate issues"
total=$(echo $numbers | wc -w)
count=0
declare -A titles
order=()
for n in $numbers; do
  count=$((count+1))
  log "checking issue #$n ($count/$total)"
  # label events of this issue; the label must have been added after the tag date
  hit=$(gh api --paginate "repos/$repo/issues/$n/events?per_page=100" \
    --jq ".[] | select(.event==\"labeled\" and .label.name==\"$label\" and .created_at > \"$since\") | .created_at" | head -1)
  [ -z "$hit" ] && continue
  if [ -n "$ccomment" ] ; then
    log "  selected #$n"
    titles[$n]=""
    order+=("$n")
    continue
  fi
  title=$(gh api "repos/$repo/issues/$n" --jq .title)
  title=${title//$'\n'/ }
  titles[$n]="$title"
  log "  selected #$n: $title"
  order+=("$n")
done

declare -A translated
if [ $translate = 1 ] && [ ${#order[@]} -gt 0 ] ; then
  # translate all titles with a single request
  log "translating ${#order[@]} titles with $model"
  out=$(for n in "${order[@]}"; do echo "$n|${titles[$n]}"; done \
    | python3 "$tdir/main.py" -s -m "$model" -p "$prompt") || echo "translation failed, using original titles" >&2
  while IFS='|' read -r n t; do
    [[ "$n" =~ ^[0-9]+$ ]] && [ -n "$t" ] && translated[$n]="$t"
  done <<< "$out"
fi
log "${#order[@]} issues selected"
if [ -n "$ccomment" ] ; then
  qcomment="'${ccomment//\'/\'\\\'\'}'"
  for n in "${order[@]}"; do
    echo "gh issue close $n --repo $repo --comment $qcomment"
  done
  exit 0
fi
for n in "${order[@]}"; do
  echo "* [#$n](https://github.com/$repo/issues/$n) ${translated[$n]:-${titles[$n]}}"
done
