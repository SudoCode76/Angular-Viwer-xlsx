import { Routes } from '@angular/router';
import {Inicio} from './components/inicio/inicio';
import {Graficos} from './components/graficos/graficos';

export const routes: Routes = [
  {path: 'inicio', component: Inicio},
  {path: 'graficos', component: Graficos},

  { path: '', redirectTo: '/inicio', pathMatch: 'full' },
  { path: '**', component: Inicio }
];
