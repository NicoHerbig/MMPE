import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import * as $ from 'jquery';
import { AuthService } from '../../services/auth/auth.service';
import {LogService} from '../../services/log/log.service';
import {ConfigService} from '../../services/config/config.service';
import {ProjectListComponent} from '../project-list/project-list.component';
import * as bcrypt from 'bcryptjs';
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  authForm: FormGroup;
  isSubmitted  =  false;
  notFound = '';
  private httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' })
  };
  constructor(private authService: AuthService, private router: Router, private formBuilder: FormBuilder,
              private logService: LogService, private configService: ConfigService, private httpClient: HttpClient) { }

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
    
    const url = getBaseLocation();
    const salt = bcrypt.genSaltSync(10);
    const password = bcrypt.hashSync(this.authForm.value.password, salt);
    const payload = {'email':this.authForm.value.email, 'password': password, 'salt':salt};
    
    this.httpClient
      .post(url, payload, this.httpOptions).subscribe(resp => {
        
        if (resp['authenticate'] !== false) {
            ProjectListComponent.projectNums = resp['authenticate'];
            this.router.navigateByUrl('/project-list');
          } else {
            this.router.navigateByUrl('/login');
            this.notFound = 'Incorrect Username/ Password. Try Again';
            $('#loginForm').trigger('reset');
          }
      });
      
    this.isSubmitted = true;
    if (this.authForm.invalid) {
      return;
    }
    
    this.authService.signIn(this.authForm.value);
  }
}

function getBaseLocation() {
  let url = window.location.href;
  let arr = url.split("/");
  let path = ":3000";
  let result = arr[0] + "//" + arr[2].split(":")[0];
  result = result + path + "/middleware/validate";
  return result;
}
