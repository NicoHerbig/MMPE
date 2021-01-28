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

  private projectsUrl = getBaseLocation();  // URL to web api

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

export function getBaseLocation() {
  let url = window.location.href;
  let arr = url.split("/");
  let path = ":3000";
  let result = arr[0] + "//" + arr[2].split(":")[0];
  result = result + path + "/projects"; 
  return result;  
}
