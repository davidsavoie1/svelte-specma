# Contributing

This document is a reminder checklist on how to publish a new version of the package to NPM.

1. Merge branch onto `Master`, ensuring everything is up-to-date;
2. Run [`npm ci`](https://docs.npmjs.com/cli/v6/commands/npm-ci) to ensure npm dependencies are up to date;
3. Build the project with `npm run build`;
4. Update version number
   - in `package.json`;
   - in `package-lock.json`;
5. Update the `CHANGELOG.md`
6. Commit with Git with new version number;
7. Create a Git tag with version number;
8. Publish to NPM with `npm publish`;
9. Push to Git
10. Push tags to Git
