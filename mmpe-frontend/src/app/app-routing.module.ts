import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import {EditingPageComponent} from './components/editing-page/editing-page.component';
import {LoginComponent} from './components/login/login.component';
import { AuthComponent } from './components/auth/auth.component';
import { ProjectListComponent } from './components/project-list/project-list.component';
import { AuthGuard } from './components/auth/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'editing-page/:id', component: EditingPageComponent, canActivate: [AuthGuard] },
  { path: 'auth', component: AuthComponent },
  { path: 'project-list', component: ProjectListComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
