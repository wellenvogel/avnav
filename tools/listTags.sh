#! /bin/bash

gh-tags() {
  local prefix="${1:-}"    # e.g. 'release-' (empty = all tags)
  local limit="${2:-0}"    # e.g. 250 (0 or empty = no limit)
  local ignore="${3:-}"    # ignore
  local page_size=100

  # Fetch fewer items per page if limit is small
  if (( limit > 0 && limit < 100 )); then
    page_size=$(( limit + 10 > 100 ? 100 : limit + 10 ))
  fi

  gh api graphql --paginate \
    -F owner='{owner}' \
    -F repo='{repo}' \
    -f prefix="$prefix" \
    -F pageSize="$page_size" \
    -f query='
    query($owner: String!, $repo: String!, $prefix: String!, $pageSize: Int!, $endCursor: String) {
      repository(owner: $owner, name: $repo) {
        refs(
          refPrefix: "refs/tags/"
          query: $prefix
          first: $pageSize
          after: $endCursor
          orderBy: {field: TAG_COMMIT_DATE, direction: DESC}
        ) {
          nodes {
            name
            target {
                  ... on Commit { committedDate }
                  ... on Tag {
                    tagger { date }
                    target { ... on Commit { committedDate } }
                  }
                }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }' --jq ' .data.repository.refs.nodes[] | "\(.name),\(.target.tagger.date // .target.committedDate)" ' \
    | { [[ "$ignore" != "" ]] && grep -v -E "$ignore" || cat; } | { [[ "$limit" -gt 0 ]] && head -n "$limit" || cat; }
}

prefix=""
limit=1
ignore=""
time=0
if [ "$1" = "-t" ] ; then
  time=1
  shift
fi
[ "$1" != "" ] && prefix="$1"
[ "$2" != "" ] && limit="$2"
[ "$3" != "" ] && ignore="$3"


if [ $time = 1 ] ; then
  gh-tags "$prefix" "$limit" "$ignore"
else
  gh-tags "$prefix" "$limit" "$ignore" | cut -d , -f 1
fi

