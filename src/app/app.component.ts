import {Component, ViewChild} from '@angular/core';
import {SchemaService} from './services/schema.service';
import {Router, RoutesRecognized} from '@angular/router';
import {Location} from '@angular/common';
import {MatMenuTrigger} from '@angular/material';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  version: string;
  latestVersion: string;
  versions: string[];

  @ViewChild('latestVersionMenuTrigger') matMenu: MatMenuTrigger;

  constructor(private schemaService: SchemaService,
              private router: Router,
              private location: Location) {
    this.schemaService.getCurrentVersionNumber()
      .subscribe(v => {
        this.version = v;
      });

    this.schemaService.getVersions()
      .subscribe(
        versions => {
          const sortedVersions = this.sortVersions(versions);
          this.latestVersion = sortedVersions[0];
        }
      );

    this.router.events.subscribe(val => {
      if (val instanceof RoutesRecognized) {
        // TODO error handling of non existent version
        let schemaVersion = val.state.root.firstChild.params['schemaVersion'];

        if (schemaVersion === 'latest') {
          this.schemaService.setLatestVersion();
        } else {
          this.selectVersion(schemaVersion);
        }

        this.schemaService
          .getVersions()
          .subscribe(vs => {
            this.versions = this.sortVersions(vs);
          });
      }
    });
  }

  selectVersion(version: string) {
    this.location.replaceState(`/viewer/${version}`);
    this.schemaService.setVersion(version);
    this.matMenu.closeMenu();
  }

  private sortVersions(versions: string[]): string[] {
    return versions.sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
  }
}
