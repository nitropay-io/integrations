// src/components/ProductList.tsx
import React from "react";

export default function ProductList({ products }) {

    return (
        <div>
        <h2 className="text-xl font-semibold mb-4">Cart</h2>
        <ul className="space-y-4">
            {products.map((p) => (
            <li key={p.id} className="flex items-center gap-4">
                <img src={p.image} alt={p.name} className="w-16 h-16 rounded-md object-cover" />
                <div className="flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-gray-500">${p.price}</p>
                </div>
            </li>
            ))}
        </ul>

        <div className="mt-6 border-t pt-4 flex justify-between font-semibold">
            <span>Total</span>
            <span>
            ${products.reduce((sum, p) => sum + p.price, 0).toFixed(2)}
            </span>
        </div>
        </div>
    );
}
