import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {ProjectService} from '../../services/project/project.service';
import {ConfigService} from '../../services/config/config.service';

@Component({
  selector: 'app-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.scss']
})
export class ProjectListComponent implements OnInit {
  public static index;

  selectedProjectId: number;
  projectIds: number[];
  constructor(private router: Router, private  projectService: ProjectService, private configService: ConfigService) { }

  ngOnInit() {
    this.getProjects();
  }

  getProjects(): void {
    this.projectIds = this.configService.projects[ProjectListComponent.index];
    this.projectService.getAllProjectIds().subscribe(projectIds => projectIds = this.projectIds);
  }

  onSelect(projectId: number): void {
    this.selectedProjectId = projectId;
    this.router.navigate(['/editing-page', projectId]);
  }
  /*logout(){
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }*/
}
