Dockerを使ったMisskey構築方法
================================================================

このガイドはDockerを使ったMisskeyセットアップ方法について解説します。

[英語版もあります - English version also available](./docker.en.md)

----------------------------------------------------------------

*1.* Misskeyのダウンロード
----------------------------------------------------------------
1. `git clone -b master git://github.com/syuilo/misskey.git` masterブランチからMisskeyレポジトリをクローン
2. `cd misskey` misskeyディレクトリに移動
3. `git checkout $(git tag -l | grep -v 'rc[0-9]*$' | sort -V | tail -n 1)` [最新のリリース](https://github.com/syuilo/misskey/releases/latest)を確認

*2.* 設定ファイルの作成と編集
----------------------------------------------------------------

下記コマンドで設定ファイルを作成してください。

```bash
cd .config
cp example.yml default.yml
cp docker_example.env docker.env
```

### `default.yml`の編集

非Docker環境と同じ様に編集してください。  
ただし、Postgresql、RedisとElasticsearchのホストは`localhost`ではなく、`docker-compose.yml`で設定されたサービス名になっています。  
標準設定では次の通りです。

| サービス       | ホスト名 |
|---------------|---------|
| Postgresql    |`db`     |
| Redis         |`redis`  |
| Elasticsearch |`es`     |

### `docker.env`の編集

このファイルはPostgresqlの設定を記述します。  
最低限記述する必要がある設定は次の通りです。

| 設定                 | 内容         |
|---------------------|--------------|
| `POSTGRES_PASSWORD` | パスワード    |
| `POSTGRES_USER`     | ユーザー名    |
| `POSTGRES_DB`       | データベース名 |

*3.* Dockerの設定
----------------------------------------------------------------
`docker-compose.yml`を編集してください。

*4.* Misskeyのビルド
----------------------------------------------------------------
次のコマンドでMisskeyをビルドしてください:

`docker-compose build`

*5.* 以上です！
----------------------------------------------------------------
お疲れ様でした。これでMisskeyを動かす準備は整いました。

### 通常起動
`docker-compose up -d`するだけです。GLHF!

### Misskeyを最新バージョンにアップデートする方法:
1. `git fetch`
2. `git stash`
3. `git checkout $(git tag -l | grep -v 'rc[0-9]*$' | sort -V | tail -n 1)`
4. `git stash pop`
5. `docker-compose build`
6. [ChangeLog](../CHANGELOG.md)でマイグレーション情報を確認する
7. `docker-compose stop && docker-compose up -d`

### cliコマンドを実行する方法:

`docker-compose run --rm web node cli/mark-admin @example`

----------------------------------------------------------------

なにかお困りのことがありましたらお気軽にご連絡ください。
