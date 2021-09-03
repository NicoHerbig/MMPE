import { Injectable } from '@angular/core';
import { User } from '../../model/user';
import {ConfigService} from '../config/config.service';
import * as $ from 'jquery';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import * as bcrypt from 'bcryptjs';

@Injectable({
  providedIn: 'root'
})

export class AuthService {
  constructor(private configService: ConfigService, private httpClient: HttpClient) { }
  private httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' })
  };
  
  public signIn(userData: User) {
    localStorage.setItem('ACCESS_TOKEN', userData.email + ' ' + userData.password);
  }
  public isLoggedIn() {
    return localStorage.getItem('ACCESS_TOKEN') !== null;
  }
  public logout() {
    localStorage.removeItem('ACCESS_TOKEN');
  }
  public isAuthenticated() : boolean{
    const token = localStorage.getItem('ACCESS_TOKEN');
    if (token !== null) {
      const email = token.substr(0, token.indexOf(' '));
      const password = token.substr(token.indexOf(' ') + 1, token.length);
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);
      const url = getBaseLocation();
      const payload = {'email':email, 'password': passwordHash, 'salt': salt};
      this.httpClient
      .post(url, payload, this.httpOptions).subscribe(resp => {
        
        if (resp['authenticate'] != false) {
          return true;
          
      }
      else {
          return false;
      }
    });
    return true;
 }
}
}


function getBaseLocation() {
  let url = window.location.href;
  let arr = url.split("/");
  let path = ":3000";
  let result = arr[0] + "//" + arr[2].split(":")[0];
  result = result + path + "/getMyData/validate";
  return result;
}
