/**
 * MCP サーバが保持する「開いている図」。アプリのキャンバス 1 枚に相当し、
 * 履歴も持つので Claude が加えた変更を undo で戻せる。
 */
import type { DiagramDoc } from '../src/types';
import { emptyDoc } from '../src/lib/doc/ops';

const HISTORY_LIMIT = 100;

export class DocumentSession {
  doc: DiagramDoc = emptyDoc();
  /** 直近に開いた / 保存したファイル。save_diagram で path 省略時に使う。 */
  filePath: string | null = null;
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  /** 変更を履歴に積んで確定する。 */
  commit(next: DiagramDoc): void {
    this.undoStack.push(JSON.stringify(this.doc));
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.doc = next;
  }

  /** ファイル読み込みやテンプレート適用のように、図をまるごと差し替える。 */
  replace(doc: DiagramDoc, filePath: string | null = null): void {
    this.commit(doc);
    this.filePath = filePath;
  }

  undo(): boolean {
    const prev = this.undoStack.pop();
    if (prev === undefined) return false;
    this.redoStack.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(prev);
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (next === undefined) return false;
    this.undoStack.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(next);
    return true;
  }

  get historyDepth(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length };
  }
}
