import { Routes } from '@angular/router';
import {Inicio} from './components/inicio/inicio';

export const routes: Routes = [
  {path: 'inicio', component: Inicio},

  { path: '', redirectTo: '/inicio', pathMatch: 'full' },
  { path: '**', component: Inicio }
];
