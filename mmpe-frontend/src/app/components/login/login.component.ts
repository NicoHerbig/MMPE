import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as $ from 'jquery';
import { AuthService } from '../../services/auth/auth.service';
import {LogService} from '../../services/log/log.service';
import {ConfigService} from '../../services/config/config.service';
import {ProjectListComponent} from '../project-list/project-list.component';
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  authForm: FormGroup;
  isSubmitted  =  false;
  notFound = '';

  constructor(private authService: AuthService, private router: Router, private formBuilder: FormBuilder,
              private logService: LogService, private configService: ConfigService) { }

  ngOnInit() {
    this.authForm  =  this.formBuilder.group({
        email: ['', Validators.required],
        password: ['', Validators.required]
    });
  }

  get formControls() {
    return this.authForm.controls;
  }

  signIn() {
    this.isSubmitted = true;
    if (this.authForm.invalid) {
      return;
    }
    this.authService.signIn(this.authForm.value);

    if (this.configService.email_IDs.includes(this.authForm.value.email) &&
      this.authForm.value.password ===
      this.configService.passwords[this.configService.email_IDs.indexOf(this.authForm.value.email)]) {
        ProjectListComponent.index = this.configService.email_IDs.indexOf(this.authForm.value.email);
        this.router.navigateByUrl('/project-list');
      } else {
        this.router.navigateByUrl('/login');
        // location.reload();
        this.notFound = 'Incorrect Username/ Password. Try Again';
        $('#loginForm').trigger('reset');
      }
  }
}
