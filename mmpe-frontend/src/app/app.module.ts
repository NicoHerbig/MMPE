import { BrowserModule } from '@angular/platform-browser';
import {APP_INITIALIZER, NgModule} from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './components/app.component';
import { APP_BASE_HREF, Location } from '@angular/common';
import { SegmentComponent } from './components/segment/segment.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SegmentsComponent } from './components/segments/segments.component';
import { AutosizeModule } from 'ngx-autosize';
import { SegmentDetailComponent, StudyDialogComponent } from './components/segment-detail/segment-detail.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SupportToolsComponent } from './components/support-tools/support-tools.component';
import { HotkeyModule } from 'angular2-hotkeys';

import { LoginComponent } from './components/login/login.component';
import { EditingPageComponent } from './components/editing-page/editing-page.component';

import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DictionaryComponent } from './components/dictionary/dictionary.component';
import {MAT_DIALOG_DEFAULT_OPTIONS, MatDialogModule} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {ConfigService} from './services/config/config.service';
import { AuthComponent } from './components/auth/auth.component';
import { ProjectListComponent } from './components/project-list/project-list.component';

@NgModule({
  declarations: [
    AppComponent,
    SegmentComponent,
    SegmentsComponent,
    SegmentDetailComponent,
    NavbarComponent,
    SupportToolsComponent,
    LoginComponent,
    EditingPageComponent,
    DictionaryComponent,
    StudyDialogComponent,
    AuthComponent,
    ProjectListComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    FormsModule,
    NgbModule,
    AutosizeModule,
    HttpClientModule,
    BrowserAnimationsModule,
    MatDialogModule,
    ReactiveFormsModule,
    HotkeyModule.forRoot(),
    MatButtonModule
  ],
  entryComponents: [
    StudyDialogComponent
  ],
  providers: [
    {provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: {hasBackdrop: false}},
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [ConfigService],
      useFactory: (appConfigService: ConfigService) => {
        return () => {
          // Make sure to return a promise!
          return appConfigService.loadAppConfig();
        };
      }
    }],
  bootstrap: [AppComponent]
})
export class AppModule { }
