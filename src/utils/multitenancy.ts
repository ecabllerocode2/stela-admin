/**
 * Utilidades para multi-tenancy (SaaS)
 * 
 * Cada documento en Firestore lleva un campo `userId` que identifica al usuario dueño.
 * Todas las lecturas se filtran con `where('userId', '==', uid)` para que:
 *   1. Cada usuario solo vea sus propios datos.
 *   2. Se lean únicamente los documentos del usuario (optimización de costos).
 * 
 * Colecciones afectadas:
 *   productos, productos_public, ordenes, clientes, clientes_credito,
 *   proveedores, finanzas, inventory_movements, devoluciones, mermas,
 *   regalos, tokens
 */

import {
  collection,
  query,
  where,
  type QueryConstraint,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../credenciales';

/** Campo que vincula cada documento con su usuario dueño */
export const TENANT_FIELD = 'userId';

/**
 * Crea un query de Firestore filtrado por el usuario actual.
 * Equivale a: query(collection(db, col), where('userId','==', uid), ...extras)
 */
export function userQuery(
  collectionName: string,
  uid: string,
  ...extraConstraints: QueryConstraint[]
) {
  return query(
    collection(db, collectionName),
    where(TENANT_FIELD, '==', uid),
    ...extraConstraints,
  );
}

/**
 * Añade el campo userId a un objeto de datos antes de guardarlo en Firestore.
 * Devuelve un nuevo objeto, no muta el original.
 */
export function withUserId<T extends DocumentData>(data: T, uid: string): T & { userId: string } {
  return { ...data, userId: uid };
}
