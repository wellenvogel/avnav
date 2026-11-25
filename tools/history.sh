#! /bin/bash
# List issues labeled ready, or pull requests merged, in a commit range.
set -eo pipefail

usage() {
  cat <<EOF
usage: $0 [-s] [-c comment] [-t] [-m model] [-p promptfile] [-l label] [-r repo] [-e end] [-P] start
  list issues with the label (default: ready) for commits in start..end
  start and end are tags or commits; end defaults to the repository's default branch
  for diverged histories, use their common ancestor as the start boundary
  -e end    include commits up to and including this tag or commit
  -P        list merged pull requests instead of issues
  -s        silent: no progress info on stderr
  -c comment  output a gh command per issue that closes it with this comment
              (markdown allowed); no titles, no translation; not valid with -P
  -t        translate titles to german with gemini (one request, needs GEMINI_API_KEY
            and python google-genai, uses newDoc/translate/main.py)
  -m model  gemini model for -t (default: gemini-3.1-flash-lite)
  -p file   markdown file with translation instructions
            (default: newDoc/translate/issue-titles-prompt.md)
  -l label  use another issue label
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
end=
pull_mode=0
model=gemini-3.1-flash-lite
scriptdir=$(cd "$(dirname "$0")" && pwd)
tdir="$scriptdir/../newDoc/translate"
prompt="$tdir/issue-titles-prompt.md"
while getopts "sc:tm:p:l:r:e:P" opt; do
  case $opt in
    s) silent=1;;
    c) ccomment="$OPTARG";;
    t) translate=1;;
    m) model="$OPTARG";;
    p) prompt="$OPTARG";;
    l) label="$OPTARG";;
    r) repo="$OPTARG";;
    e) [ -n "$OPTARG" ] || usage; end="$OPTARG";;
    P) pull_mode=1;;
    *) usage;;
  esac
done
shift $((OPTIND-1))
[ "$#" -eq 1 ] || usage
start=$1
[ -n "$start" ] || usage
if [ "$pull_mode" = 1 ] && [ -n "$ccomment" ]; then
  echo "-c cannot be used with -P" >&2
  exit 1
fi
[ -n "$ccomment" ] && translate=0
log() { [ "$silent" = 1 ] || echo "$@" >&2; }
for c in gh jq git; do
  command -v "$c" >/dev/null || { echo "$c not found" >&2; exit 1; }
done
if [ "$translate" = 1 ]; then
  [ -f "$prompt" ] || { echo "prompt file $prompt not found" >&2; exit 1; }
  [ -n "$GEMINI_API_KEY" ] || { echo "GEMINI_API_KEY not set" >&2; exit 1; }
fi

if [ -n "$repo" ]; then
  repo=${repo#*github.com/}
  repo=${repo%/}
  repo=${repo%.git}
  repo=$(gh repo view "$repo" --json nameWithOwner -q .nameWithOwner)
else
  repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
fi
owner=${repo%%/*}
name=${repo#*/}
if [ -z "$end" ]; then
  end=$(gh repo view "$repo" --json defaultBranchRef -q .defaultBranchRef.name)
  bounded=0
else
  bounded=1
fi

resolve_commit() {
  local ref=$1 encoded
  encoded=$(jq -rn --arg ref "$ref" '$ref | @uri')
  gh api "repos/$repo/commits/$encoded" --jq '{sha, date: .commit.committer.date}'
}
start_commit=$(resolve_commit "$start") || { echo "cannot resolve start: $start" >&2; exit 1; }
end_commit=$(resolve_commit "$end") || { echo "cannot resolve end: $end" >&2; exit 1; }
start_sha=$(jq -r .sha <<< "$start_commit")
end_sha=$(jq -r .sha <<< "$end_commit")
since=$(jq -r .date <<< "$start_commit")
until=$(jq -r .date <<< "$end_commit")

# GitHub's compare API is paginated: do not rely on its unpaginated 250-commit limit.
compare() {
  gh api --paginate --slurp "repos/$repo/compare/$1...$2?per_page=100"
}
comparison=$(compare "$start_sha" "$end_sha")
status=$(jq -r '.[0].status' <<< "$comparison")
if [ "$status" = diverged ]; then
  # GitHub selects a merge base even when Git has multiple common ancestors.
  # Use it consistently for both the commit range and the label-date fallback.
  base=$(jq -ce '.[0].merge_base_commit | select(.sha != null and .commit.committer.date != null) | {sha, date: .commit.committer.date}' <<< "$comparison") ||
    { echo "cannot determine common ancestor of $start and $end" >&2; exit 1; }
  start_sha=$(jq -r .sha <<< "$base")
  since=$(jq -r .date <<< "$base")
  log "diverged histories: using common ancestor $start_sha ($since) as start"
  comparison=$(compare "$start_sha" "$end_sha")
  status=$(jq -r '.[0].status' <<< "$comparison")
fi
if [ "$status" != ahead ] && [ "$status" != identical ]; then
  echo "cannot use start $start with end $end ($status)" >&2
  exit 1
fi
range=$(jq -c '[.[] | .commits[].sha] | unique' <<< "$comparison")
expected=$(jq -r '.[0].ahead_by' <<< "$comparison")
actual=$(jq 'length' <<< "$range")
if [ "$actual" -ne "$expected" ]; then
  echo "incomplete commit comparison: got $actual of $expected commits" >&2
  exit 1
fi
log "commit range $repo: $start_sha..$end_sha ($actual commits)"

declare -A titles
order=()

# Fetch pages for several issues at once, while retaining every timeline event.
fetch_timelines() {
  local -a pending=("$@") next
  local -A cursors=()
  local n cursor query result item has_more
  while [ "${#pending[@]}" -gt 0 ]; do
    next=()
    while [ "${#pending[@]}" -gt 0 ]; do
      local -a batch=("${pending[@]:0:20}")
      pending=("${pending[@]:20}")
      query='query($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){'
      for n in "${batch[@]}"; do
        cursor=
        if [ -n "${cursors[$n]}" ]; then
          cursor=",after:$(jq -Rn --arg c "${cursors[$n]}" '$c')"
        fi
        query+="i$n:issue(number:$n){timelineItems(first:100$cursor,itemTypes:[LABELED_EVENT,REFERENCED_EVENT,CLOSED_EVENT]){pageInfo{hasNextPage endCursor} nodes{__typename ... on LabeledEvent{createdAt label{name}} ... on ReferencedEvent{createdAt commit{oid committedDate}} ... on ClosedEvent{createdAt closer{__typename ... on Commit{oid committedDate} ... on PullRequest{number merged mergedAt mergeCommit{oid committedDate}}}}}}}"
      done
      query+='}}'
      result=$(gh api graphql -f query="$query" -f owner="$owner" -f repo="$name")
      for n in "${batch[@]}"; do
        item=$(jq -ce --arg key "i$n" '.data.repository[$key].timelineItems // error("missing issue timeline")' <<< "$result")
        timelines[$n]=$(jq -cn --argjson previous "${timelines[$n]:-[]}" --argjson page "$item" '$previous + $page.nodes')
        has_more=$(jq -r .pageInfo.hasNextPage <<< "$item")
        if [ "$has_more" = true ]; then
          cursors[$n]=$(jq -er .pageInfo.endCursor <<< "$item")
          next+=("$n")
        fi
      done
    done
    pending=("${next[@]}")
  done
}

# Resolve PRs associated with commits, including every page for unusually popular commits.
fetch_commit_pulls() {
  local -a pending=("$@") next
  local -A cursors=()
  local sha cursor query result item has_more
  while [ "${#pending[@]}" -gt 0 ]; do
    next=()
    while [ "${#pending[@]}" -gt 0 ]; do
      local -a batch=("${pending[@]:0:20}")
      pending=("${pending[@]:20}")
      query='query($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){'
      for sha in "${batch[@]}"; do
        cursor=
        if [ -n "${cursors[$sha]}" ]; then
          cursor=",after:$(jq -Rn --arg c "${cursors[$sha]}" '$c')"
        fi
        query+="c$sha:object(oid:\"$sha\"){... on Commit{associatedPullRequests(first:100$cursor){pageInfo{hasNextPage endCursor} nodes{number title merged mergedAt mergeCommit{oid committedDate} repository{nameWithOwner}}}}}"
      done
      query+='}}'
      result=$(gh api graphql -f query="$query" -f owner="$owner" -f repo="$name")
      for sha in "${batch[@]}"; do
        item=$(jq -ce --arg key "c$sha" '.data.repository[$key].associatedPullRequests // error("missing commit or pull requests")' <<< "$result")
        commit_pulls[$sha]=$(jq -cn --argjson previous "${commit_pulls[$sha]:-[]}" --argjson page "$item" '$previous + $page.nodes')
        has_more=$(jq -r .pageInfo.hasNextPage <<< "$item")
        if [ "$has_more" = true ]; then
          cursors[$sha]=$(jq -er .pageInfo.endCursor <<< "$item")
          next+=("$sha")
        fi
      done
    done
    pending=("${next[@]}")
  done
}

declare -A commit_pulls
if [ "$pull_mode" = 1 ]; then
  mapfile -t commits < <(jq -r '.[]' <<< "$range")
  log "checking ${#commits[@]} commits for merged pull requests"
  fetch_commit_pulls "${commits[@]}"
  pulls='[]'
  for sha in "${commits[@]}"; do
    pulls=$(jq -cn --argjson previous "$pulls" --argjson page "${commit_pulls[$sha]}" \
      --arg sha "$sha" --arg repo "$repo" \
      '$previous + [$page[] | select(.merged and .repository.nameWithOwner == $repo and .mergeCommit.oid == $sha)]')
  done
  while IFS= read -r item; do
    n=$(jq -r .number <<< "$item")
    titles[$n]=$(jq -r '.title | gsub("\n"; " ")' <<< "$item")
    order+=("$n")
  done < <(jq -c 'unique_by(.number) | sort_by(.number) | .[]' <<< "$pulls")
else
  log "finding issues currently labeled \"$label\" since $start_sha ($since)"
  encoded_label=$(jq -rn --arg label "$label" '$label | @uri')
  candidates=$(gh api --paginate --slurp \
    "repos/$repo/issues?state=all&labels=$encoded_label&since=$since&per_page=100" |
    jq -c --arg label "$label" '[.[][] | select(.pull_request == null and any(.labels[]; .name == $label)) | {number,title}] | unique_by(.number) | sort_by(.number)')
  mapfile -t numbers < <(jq -r '.[].number' <<< "$candidates")
  log "found ${#numbers[@]} candidate issues"
  declare -A timelines
  fetch_timelines "${numbers[@]}"

  # A commit can itself close an issue when its PR is merged. Resolve such
  # closures to the PR's merge commit when the merge and closure coincide.
  mapfile -t closing_commits < <(
    for n in "${numbers[@]}"; do
      jq -r '.[] | select(.__typename == "ClosedEvent" and .closer.__typename == "Commit") | .closer.oid' <<< "${timelines[$n]}"
    done | sort -u
  )
  fetch_commit_pulls "${closing_commits[@]}"
  while IFS= read -r candidate; do
    n=$(jq -r .number <<< "$candidate")
    timeline=${timelines[$n]}
    label_at=$(jq -r --arg label "$label" \
      '[.[] | select(.__typename == "LabeledEvent" and .label.name == $label) | .createdAt] | max // empty' <<< "$timeline")
    [ -n "$label_at" ] || continue

    # Rule: use the latest commit linked before the latest label application.
    # A merged closing PR contributes its effective merge commit; direct issue
    # references contribute their referenced commits. Both the link event and
    # commit date must be no later than the label. Rank by committer date, using
    # the link time to break ties. Compare ancestry, not dates, with the range.
    linked=$(jq -c '
      [.[] |
        if .__typename == "ReferencedEvent" then
          {oid: .commit.oid, date: .commit.committedDate, available: .createdAt}
        elif .__typename == "ClosedEvent" and .closer.__typename == "Commit" then
          {oid: .closer.oid, date: .closer.committedDate, available: .createdAt}
        elif .__typename == "ClosedEvent" and .closer.__typename == "PullRequest" and .closer.merged then
          {oid: .closer.mergeCommit.oid, date: .closer.mergeCommit.committedDate, available: .closer.mergedAt}
        else empty end]' <<< "$timeline")
    while IFS= read -r closure; do
      sha=$(jq -r .closer.oid <<< "$closure")
      closed_at=$(jq -r .createdAt <<< "$closure")
      # GitHub sometimes records the original PR commit rather than the PR
      # itself as closer. Match its associated PR by merge and closure time.
      replacement=$(jq -c --arg repo "$repo" --arg closed "$closed_at" '
        [.[] | select(.merged and .repository.nameWithOwner == $repo and .mergedAt != null)
         | select((($closed | fromdateiso8601) - (.mergedAt | fromdateiso8601)) as $d | $d >= 0 and $d <= 300)
         | {oid: .mergeCommit.oid, date: .mergeCommit.committedDate, available: .mergedAt}]' <<< "${commit_pulls[$sha]}")
      linked=$(jq -cn --argjson linked "$linked" --argjson replacement "$replacement" '$linked + $replacement')
    done < <(jq -c '.[] | select(.__typename == "ClosedEvent" and .closer.__typename == "Commit")' <<< "$timeline")

    if jq -e 'any(.[]; .oid == null or .date == null or .available == null)' <<< "$linked" >/dev/null; then
      echo "issue #$n has a linked commit with missing metadata" >&2
      exit 1
    fi
    latest=$(jq -r --arg at "$label_at" \
      '[.[] | select(.available <= $at and .date <= $at)] | sort_by(.date, .available) | last | .oid // empty' <<< "$linked")
    selected=0
    if [ -n "$latest" ]; then
      if jq -e --arg sha "$latest" 'index($sha) != null' <<< "$range" >/dev/null; then selected=1; fi
    elif [ "$(jq 'length' <<< "$linked")" -eq 0 ]; then
      # Fallback only when the issue has no linked commits at all: use the
      # label event date, with an exclusive start and an inclusive explicit end.
      if [[ "$label_at" > "$since" ]] && { [ "$bounded" = 0 ] || [[ "$label_at" < "$until" || "$label_at" = "$until" ]]; }; then
        selected=1
      fi
    fi
    if [ "$selected" = 1 ]; then
      titles[$n]=$(jq -r '.title | gsub("\n"; " ")' <<< "$candidate")
      order+=("$n")
      log "selected #$n: ${titles[$n]}"
    fi
  done < <(jq -c '.[]' <<< "$candidates")
fi

declare -A translated
if [ "$translate" = 1 ] && [ "${#order[@]}" -gt 0 ]; then
  log "translating ${#order[@]} titles with $model"
  out=$(for n in "${order[@]}"; do echo "$n|${titles[$n]}"; done \
    | python3 "$tdir/main.py" -s -m "$model" -p "$prompt") || echo "translation failed, using original titles" >&2
  while IFS='|' read -r n t; do
    [[ "$n" =~ ^[0-9]+$ ]] && [ -n "$t" ] && translated[$n]="$t"
  done <<< "$out"
fi
log "${#order[@]} items selected"
if [ -n "$ccomment" ]; then
  qcomment="'${ccomment//\'/\'\\\'\'}'"
  for n in "${order[@]}"; do
    echo "gh issue close $n --repo $repo --comment $qcomment"
  done
  exit 0
fi
kind=issues
[ "$pull_mode" = 1 ] && kind=pull
for n in "${order[@]}"; do
  echo "* [#$n](https://github.com/$repo/$kind/$n) ${translated[$n]:-${titles[$n]}}"
done
