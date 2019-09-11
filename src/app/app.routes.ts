import {Routes} from '@angular/router';
import {ViewerComponent} from './viewer/viewer.component';

export const AppRoutes: Routes = [
  {path: 'viewer/:schemaVersion', component: ViewerComponent},
  {path: 'viewer/:schemaVersion/:schemaFullPath', component: ViewerComponent},
  {path: '**', redirectTo: '/viewer/latest', pathMatch: 'full'}
];

