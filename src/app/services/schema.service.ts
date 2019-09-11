import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {map} from 'rxjs/operators';
import {AvroSchema, AvroUtil} from '../models/avro-schema.model';

@Injectable({
  providedIn: 'root'
})
export class SchemaService {
  private schemaSubject: Subject<AvroSchema> = new Subject<AvroSchema>();
  private currentVersionNumber: BehaviorSubject<string> = new BehaviorSubject<string>('');

  constructor(private httpClient: HttpClient) {
  }

  public getSchemaObservable(): Observable<any> {
    return this.schemaSubject.asObservable();
  }

  public getCurrentVersionNumber(): Observable<string> {
    return this.currentVersionNumber.asObservable();
  }

  public setLatestVersion() {
    this.getVersions()
      .subscribe((versions: string[]) => {
        let versionsSorted = versions.sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
        let latestVersion = versionsSorted[0];

        this.currentVersionNumber.next(latestVersion);
        this.setSchemaObservable(latestVersion);
      });
  }

  public setVersion(version: string) {
    this.getVersions()
      .subscribe((versions: string[]) => {
        let versionExists = versions.includes(version);

        if (!versionExists) {
          console.error(`Schema version ${version} does not exist. Existing versions: ${versions}`);
        }

        this.currentVersionNumber.next(version);
        this.setSchemaObservable(version);
      });
  }

  public getVersions(): Observable<any> {
    return this.httpClient
      .get('./assets/avsc/versions.json')
  }

  private setSchemaObservable(version: string): void {
    this.httpClient
      .get(`./assets/avsc/${version}/schema.avsc`)
      .pipe(
        map((response: any) => {
            return AvroUtil.parseAvsc(response);
          }
        ),
      )
      .subscribe(
        tree => this.schemaSubject.next(tree),
        err => console.error(err)
      );
  }
}
