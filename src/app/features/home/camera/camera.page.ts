import { Component, ElementRef, ViewChild } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';
import { catchError, concatMap, distinctUntilChanged } from 'rxjs/operators';
import { CameraService } from '../../../shared/camera/camera.service';
import { DialogsService } from '../../../shared/dialogs/dialogs.service';
import { MomentRepository } from '../../../shared/moment/moment-repository.service';
import { concatTap, isNonNullable } from '../../../utils/rx-operators';

@UntilDestroy()
@Component({
  selector: 'app-camera',
  templateUrl: './camera.page.html',
  styleUrls: ['./camera.page.scss'],
})
export class CameraPage {
  readonly videoDevices$ = this.cameraService.videoDevices$;

  private readonly _videoElement$ = new BehaviorSubject<
    HTMLVideoElement | undefined
  >(undefined);

  private readonly videoElement$ = this._videoElement$.pipe(
    isNonNullable(),
    distinctUntilChanged()
  );

  @ViewChild('video')
  set videoElement(value: ElementRef<HTMLVideoElement> | undefined) {
    if (value) this._videoElement$.next(value.nativeElement);
  }

  readonly capturedImageUrl$ = this.cameraService.capturedImageUrl$;

  constructor(
    private readonly dialogsService: DialogsService,
    private readonly momentRepository: MomentRepository,
    private readonly cameraService: CameraService
  ) {
    this.startPreview();
  }

  private startPreview() {
    return this.videoElement$
      .pipe(
        concatMap(videoElement =>
          this.cameraService.connectPreview$(videoElement)
        ),
        catchError(async (err: unknown) => this.presentError(err)),
        untilDestroyed(this)
      )
      .subscribe();
  }

  capture() {
    this.cameraService
      .capture$()
      .pipe(
        concatTap(imageBlob => this.momentRepository.add$(imageBlob)),
        catchError(async (err: unknown) => this.presentError(err)),
        untilDestroyed(this)
      )
      .subscribe();
  }

  reverseCamera() {
    return this.videoElement$
      .pipe(
        concatMap(videoElement => this.cameraService.nextCamera$(videoElement)),
        catchError(async (err: unknown) => this.presentError(err)),
        untilDestroyed(this)
      )
      .subscribe();
  }

  async presentError(error: unknown) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return this.dialogsService.presentAlert({
        headerKey: `error.${error.name}`,
        messageKey: 'message.cameraPermissionDenied',
      });
    }
    return this.dialogsService.presentError(error);
  }
}
