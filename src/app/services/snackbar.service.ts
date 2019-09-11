import {MatSnackBar, MatSnackBarConfig} from '@angular/material';
import {Injectable} from '@angular/core';

@Injectable()
export class SnackBarService {

  constructor(public snackBar: MatSnackBar) {
  }

  openSnackBar(message: string) {
    let config = new MatSnackBarConfig();
    config.duration = 2500;
    config.panelClass = ['snackbar'];

    this.snackBar.open(message, null, config);
  }
}
