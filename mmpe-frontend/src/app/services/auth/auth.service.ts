import { Injectable } from '@angular/core';
import { User } from '../../model/user';
import {ConfigService} from '../config/config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private configService: ConfigService) { }
  public signIn(userData: User) {
    localStorage.setItem('ACCESS_TOKEN', userData.email + ' ' + userData.password);
  }
  public isLoggedIn() {
    return localStorage.getItem('ACCESS_TOKEN') !== null;
  }
  public logout() {
    localStorage.removeItem('ACCESS_TOKEN');
  }
  public isAuthenticated(): boolean {
    const token = localStorage.getItem('ACCESS_TOKEN');
    if (token !== null) {
      const email = token.substr(0, token.indexOf(' '));
      const password = token.substr(token.indexOf(' ') + 1, token.length);
      if (this.configService.email_IDs.includes(email) &&
        password === this.configService.passwords[this.configService.email_IDs.indexOf(email)]) {
        return true;
      }
    } else {
      return false;
    }
 }
}
