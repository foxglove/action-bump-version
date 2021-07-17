# @foxglove/action-bump-version

GitHub Action to update package.json versions in a monorepo.

See [action.yml](/action.yml) for inputs and outputs.

When using `push: true`, make sure to set `token` in `@actions/checkout` so that we have permission to push:

```yaml
- uses: actions/checkout@v2
  with:
    ref: ${{ github.event.inputs.commitish }}
    token: ${{ secrets.SECRET_GITHUB_TOKEN }}

- uses: foxglove/action-bump-version@v1
  with:
    version: ${{ github.event.inputs.version }}
    branch: true
    push: true
```

Bundled JS is committed directly to git in this repo. Remember to run `yarn watch` or `yarn build` before committing!
