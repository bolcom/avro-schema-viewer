import {BrowserModule, DomSanitizer} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {Location} from '@angular/common';

import {BrowserAnimationsModule} from '@angular/platform-browser/animations';

import {AppComponent} from './app.component';

import {FlexLayoutModule} from '@angular/flex-layout';

import {
  MatButtonModule,
  MatCardModule,
  MatCheckboxModule,
  MatChipsModule,
  MatDialogModule,
  MatDividerModule,
  MatIconModule,
  MatIconRegistry,
  MatInputModule,
  MatListModule,
  MatMenuModule,
  MatPaginatorModule,
  MatProgressSpinnerModule,
  MatSelectModule,
  MatSidenavModule,
  MatSlideToggleModule,
  MatSnackBarModule,
  MatSortModule,
  MatTableModule,
  MatTabsModule,
  MatToolbarModule,
  MatTooltipModule
} from '@angular/material';

import 'hammerjs';
import {RouterModule} from '@angular/router';
import {AppRoutes} from './app.routes';
import {SnackBarService} from './services/snackbar.service';
import {ViewerComponent} from './viewer/viewer.component';
import {VisualizerComponent} from './viewer/visualizer/visualizer.component';
import {SchemaService} from './services/schema.service';
import {DetailsComponent} from './viewer/details/details.component';
import {ClipboardModule} from 'ngx-clipboard';
import {HelpComponent} from './viewer/help/help.component';

@NgModule({
  declarations: [
    AppComponent,
    ViewerComponent,
    VisualizerComponent,
    DetailsComponent,
    HelpComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    // Hash is used, as this is hosted on Gitlab Pages internally, which only supports SPA using hashes
    RouterModule.forRoot(AppRoutes, {useHash: true}),

    // Material
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatDividerModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatSelectModule,
    MatSidenavModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatToolbarModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatChipsModule,

    // Flex-layout
    FlexLayoutModule,

    // Copy to clipboard
    ClipboardModule
  ],
  providers: [
    SnackBarService,
    SchemaService,
    Location
  ],
  entryComponents: [
    HelpComponent
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(matIconRegistry: MatIconRegistry, domSanitizer: DomSanitizer) {
    matIconRegistry.addSvgIconSet(domSanitizer.bypassSecurityTrustResourceUrl('./assets/mdi.svg'));
  }
}
