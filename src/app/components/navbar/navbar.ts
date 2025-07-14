import { Component } from '@angular/core';
import {Menubar} from 'primeng/menubar';

@Component({
  selector: 'app-navbar',
  imports: [
    Menubar
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  items = [
    {
      label: 'Inicio',
      icon: 'pi pi-home',
      routerLink: '/'
    },
    {
      label: 'Graficos',
      icon: 'pi pi-chart-bar',
      routerLink: '/graficos'
    },


    {
      label: 'About',
      icon: 'pi pi-info',
      routerLink: '/about'
    }

  ];

}
