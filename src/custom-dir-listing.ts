/* eslint-disable @typescript-eslint/ban-ts-comment */

import { ArrayExt } from '@lumino/algorithm';
import { DirListing } from '@jupyterlab/filebrowser';
import { PathExt } from '@jupyterlab/coreutils';
import { renameFile, isValidFileName } from '@jupyterlab/docmanager';
import { showErrorMessage } from '@jupyterlab/apputils';
import { Contents } from '@jupyterlab/services';

/**
 * Customised DirListing for tree view
 */
export class CustomDirListing extends DirListing {
  rename(): Promise<string> {
    return this._doTreeRename();
  }

  private async _doTreeRename(): Promise<string> {
    (this as any)._inRename = true;
    const items = (this as any)._sortedItems as Contents.IModel[]; // Ensure correct type
    const path = Object.keys(this.selection)[0];
    const index = ArrayExt.findFirstIndex(
      items,
      (value: Contents.IModel) => value.path === path
    ); // Explicit type
    const row = (this as any)._items[index];
    const item = items[index];
    const nameNode = this.renderer.getNameNode(row);
    const original = item.name;
    (this as any)._editNode.value = original;
    (this as any)._selectItem(index, false);

    try {
      const newName = await Private.doRename(
        nameNode,
        (this as any)._editNode,
        original
      );
      this.node.focus();

      if (!newName || newName === original) {
        (this as any)._inRename = false;
        return original;
      }

      if (!isValidFileName(newName)) {
        await showErrorMessage(
          (this as any)._trans.__('Rename Error'),
          Error(
            (this as any)._trans._p(
              'showErrorMessage',
              '"%1" is not a valid name for a file. Names must have nonzero length, and cannot include "/", "\\", or ":"',
              newName
            )
          )
        );
        (this as any)._inRename = false;
        return original;
      }

      if (this.isDisposed) {
        (this as any)._inRename = false;
        throw new Error('File browser is disposed.');
      }

      const manager = this.model.manager;

      const oldModelPath = this.model.path;
      let modelPath = oldModelPath;
      // If item is directory, change the modelPath to the parent path, instead of the complete path for rename to work as expected
      if (item.type === 'directory' && this.model.path === '/' + item.path) {
        modelPath = '/' + PathExt.dirname(item.path);
      }

      const oldPath = PathExt.join(modelPath, original);
      const newPath = PathExt.join(modelPath, newName);
      await renameFile(manager, oldPath, newPath);

      if (this.isDisposed) {
        (this as any)._inRename = false;
        throw new Error('File browser is disposed.');
      }

      if ((this as any)._inRename) {
        // No need to catch because `newName` will always exist.
        await this.selectItemByName(newName);
      }
      (this as any)._inRename = false;
      return newName;
    } catch (error) {
      const errorMessage =
        typeof error === 'string'
          ? error
          : error instanceof Error
            ? error.message
            : 'An unknown error occurred';
      if (error !== 'File not renamed') {
        await showErrorMessage(
          (this as any)._trans._p('showErrorMessage', 'Rename Error'),
          errorMessage
        );
      }
      (this as any)._inRename = false;
      return original;
    }
  }
}

/**
 * The namespace for the listing private data.
 */
namespace Private {
  /**
   * Handle editing text on a node.
   *
   * @returns Boolean indicating whether the name changed.
   */
  export function doRename(
    text: HTMLElement,
    edit: HTMLInputElement,
    original: string
  ): Promise<string> {
    const parent = text.parentElement as HTMLElement;
    parent.replaceChild(edit, text);
    edit.focus();
    const index = edit.value.lastIndexOf('.');
    if (index === -1) {
      edit.setSelectionRange(0, edit.value.length);
    } else {
      edit.setSelectionRange(0, index);
    }

    return new Promise<string>((resolve, reject) => {
      edit.onblur = () => {
        parent.replaceChild(text, edit);
        resolve(edit.value);
      };
      edit.onkeydown = (event: KeyboardEvent) => {
        switch (event.keyCode) {
          case 13: // Enter
            event.stopPropagation();
            event.preventDefault();
            edit.blur();
            break;
          case 27: // Escape
            event.stopPropagation();
            event.preventDefault();
            edit.value = original;
            edit.blur();
            break;
          case 38: // Up arrow
            event.stopPropagation();
            event.preventDefault();
            if (edit.selectionStart !== edit.selectionEnd) {
              edit.selectionStart = edit.selectionEnd = 0;
            }
            break;
          case 40: // Down arrow
            event.stopPropagation();
            event.preventDefault();
            if (edit.selectionStart !== edit.selectionEnd) {
              edit.selectionStart = edit.selectionEnd = edit.value.length;
            }
            break;
          default:
            break;
        }
      };
    });
  }
}

/* eslint-enable @typescript-eslint/ban-ts-comment */
