# Contribution guide
:v: Thanks for your contributions :v:

## Issues
Feature suggestions and bug reports are filed in https://github.com/syuilo/misskey/issues .
Before creating a new issue, please search existing issues to avoid duplication.
If you find the existing issue, please add your reaction or comment to the issue.

## Localization (l10n)
Please use [Crowdin](https://crowdin.com/project/misskey) for localization.

![Crowdin](https://d322cqt584bo4o.cloudfront.net/misskey/localized.svg)

## Internationalization (i18n)
Misskey uses [vue-i18n](https://github.com/kazupon/vue-i18n).

## Documentation
* Documents for contributors are located in `/docs`.
* Documents for instance admins are located in `/docs`.
* Documents for end users are located in `src/docs`.

## Test
* Test codes are located in `/test`.

## Continuous integration
Misskey uses CircleCI for automated test.
Configuration files are located in `/.circleci`.

## Glossary
### AP
Stands for _**A**ctivity**P**ub_.

### MFM
Stands for _**M**isskey **F**lavored **M**arkdown_.

### Mk
Stands for _**M**iss**k**ey_.

### SW
Stands for _**S**ervice**W**orker_.

### Nyaize
Convert な(na) to にゃ(nya)

#### Denyaize
Revert Nyaize

## Code style
### Use semicolon
To avoid ASI Hazard

### Don't use `export default`
Bad:
``` ts
export default function(foo: string): string {
```

Good:
``` ts
export function something(foo: string): string {
```

## Directory structure
```
src ... Source code
	@types ... Type definitions
	prelude ... Independence utils for coding JavaScript without side effects
	misc ... Independence utils for Misskey without side effects
	service ... Common functions with side effects
	queue ... Job queues and Jobs
	server ... Web Server
	client ... Client
	mfm ... MFM

test ... Test code

```

## Notes
### `null` in SQL
SQLを発行する際、パラメータが`null`になる可能性のある場合はSQL文を出し分けなければならない
例えば
``` ts
query.where('file.folderId = :folderId', { folderId: ps.folderId });
```
という処理で、`ps.folderId`が`null`だと結果的に`file.folderId = null`のようなクエリが発行されてしまい、これは正しいSQLではないので期待した結果が得られない
だから次のようにする必要がある
``` ts
if (ps.folderId) {
	query.where('file.folderId = :folderId', { folderId: ps.folderId });
} else {
	query.where('file.folderId IS NULL');
}
```

### `[]` in SQL
SQLを発行する際、`IN`のパラメータが`[]`(空の配列)になる可能性のある場合はSQL文を出し分けなければならない
例えば
``` ts
const users = await Users.find({
	id: In(userIds)
});
```
という処理で、`userIds`が`[]`だと結果的に`user.id IN ()`のようなクエリが発行されてしまい、これは正しいSQLではないので期待した結果が得られない
だから次のようにする必要がある
``` ts
const users = userIds.length > 0 ? await Users.find({
	id: In(userIds)
}) : [];
```
