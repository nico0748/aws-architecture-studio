/**
 * ファイルの読み書きは作業ディレクトリ配下に限定する。MCP サーバはモデルからの
 * 指示でパスを受け取るため、範囲を絞っておかないと任意の場所へ書けてしまう。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

export class Workspace {
  constructor(readonly root: string) {}

  /** root の外を指すパスを弾いたうえで絶対パスに正規化する。 */
  resolve(path: string): string {
    const abs = isAbsolute(path) ? resolve(path) : resolve(this.root, path);
    const rel = relative(this.root, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`作業ディレクトリの外は扱えません: ${path}（root: ${this.root}）`);
    }
    return abs;
  }

  /** 表示用に root からの相対パスへ戻す。 */
  display(abs: string): string {
    return relative(this.root, abs) || '.';
  }

  async read(path: string): Promise<string> {
    return readFile(this.resolve(path), 'utf8');
  }

  async write(path: string, data: string | Buffer): Promise<string> {
    const abs = this.resolve(path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, data);
    return abs;
  }
}
