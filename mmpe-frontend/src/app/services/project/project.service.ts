import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {Observable} from 'rxjs';
import {Project} from '../../model/project';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  httpOptions = {
    headers: new HttpHeaders({ 'Content-Type': 'application/json' })
  };

  private projectsUrl = 'http://localhost:3000/projects';  // URL to web api

  constructor( private http: HttpClient) { }

  getProject(id: number): Observable<Project> {
    console.log('accessing data now');
    const url = `${this.projectsUrl}/${id}`;
    return this.http.get<Project>(url);
  }

  updateProject(project: Project): Observable<any> {
    const url = `${this.projectsUrl}/${project.projectid}`;
    return this.http.put(url, JSON.stringify(project), this.httpOptions);
  }

  getAllProjectIds(): Observable<number[]> {
    return this.http.get<number[]>(this.projectsUrl);
  }
}
