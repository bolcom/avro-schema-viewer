class SchemaViewerProperties {
  private _colors = {
    background: '#FFFFFF',
    links: '#CCCCCC',
    filledNode: '#B1C4DD',
    nodeBorder: '#4983B2',
    text: '#000000',
    highlight: '#24CA4B'
  };

  private _nodeSize = 10;
  private _nodeBorderWidth = '1px';

  private _linkWidth = '2px';

  private _helpModalHeight = '50vh';
  private _helpModalWidth = '675px';

  private _showRootNodeNameInCopyPath = true;

  get colors(): { filledNode: string; highlight: string; background: string; nodeBorder: string; links: string; text: string } {
    return this._colors;
  }

  get linkWidth(): string {
    return this._linkWidth;
  }

  get nodeBorderWidth(): string {
    return this._nodeBorderWidth;
  }

  get nodeSize(): number {
    return this._nodeSize;
  }

  get helpModalWidth(): string {
    return this._helpModalWidth;
  }

  get helpModalHeight(): string {
    return this._helpModalHeight;
  }

  get showRootNodeNameInCopyPath(): boolean {
    return this._showRootNodeNameInCopyPath;
  }
}

export const ViewerProperties = new SchemaViewerProperties();
