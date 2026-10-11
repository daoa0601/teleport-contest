import { InMemoryStorage } from '../../js/storage.js';

export function memoryStorage(): InMemoryStorage {
    return new InMemoryStorage();
}
