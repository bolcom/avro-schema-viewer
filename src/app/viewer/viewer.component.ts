import {Component, HostListener, ViewChild} from '@angular/core';
import {SchemaType} from '../models/avro-schema.model';
import {SnackBarService} from '../services/snackbar.service';
import * as _ from 'lodash';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {VisualizerComponent} from './visualizer/visualizer.component';
import {MatDialog} from '@angular/material';
import {HelpComponent} from './help/help.component';
import {ViewerProperties} from '../shared/viewer.properties';

@Component({
  selector: 'app-home',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent {
  selectedSchema: SchemaType;
  searchResults: string[];
  searchResultsVisible = false;
  selectedSchemaFullpath: string;
  searchForm: FormGroup;

  @ViewChild('visualizer') visualizer: VisualizerComponent;

  constructor(private snackbarService: SnackBarService,
              private fb: FormBuilder,
              private dialog: MatDialog) {
    this.searchForm = fb.group({
      query: ['', Validators.required],
    });
  }

  public setSelectedNodePath(selectedSchema: SchemaType) {
    this.selectedSchema = selectedSchema;
    this.selectedSchemaFullpath = this.selectedSchema.fullpath;

    if (!ViewerProperties.showRootNodeNameInCopyPath) {
      let fullpathSplitted = this.selectedSchema.fullpath.split('.');
      let schemaFullpathWithoutRoot = fullpathSplitted.slice(1, fullpathSplitted.length).join('.');
      this.selectedSchemaFullpath = _.isEmpty(schemaFullpathWithoutRoot) ? this.selectedSchema.fullpath : schemaFullpathWithoutRoot;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent) {
    this.onCloseSearchResults();
  }

  showCopiedMessage() {
    this.snackbarService.openSnackBar('Path copied to clipboard');
  }

  onSearch() {
    this.searchResults = this.visualizer.search(this.searchForm.controls['query'].value);
    this.searchResultsVisible = true;
  }

  onSelectSearchResult(selectedResult: string) {
    this.visualizer.setAllFieldsVisible(false);
    this.visualizer.selectNodeByFullPath(selectedResult);
    this.onCloseSearchResults();
  }

  onCloseSearchResults() {
    this.searchResultsVisible = false;
    this.searchForm.reset({query: ''});
  }

  showHelp() {
    let dialogRef = this.dialog.open(HelpComponent, {
      height: ViewerProperties.helpModalHeight,
      width: ViewerProperties.helpModalWidth,
    });
  }
}
