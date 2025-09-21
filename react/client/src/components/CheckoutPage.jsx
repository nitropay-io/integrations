// src/components/CheckoutPage.tsx
import React from "react";
import ProductList from "./ProductList";
import PaymentForm from "./PaymentForm";

const randomPrice = () => Number((Math.random() + 1).toFixed(2))

const products = [
    { id: 1, name: "Nitro T-Shirt", price: randomPrice(), image: "/nitropay-tshirt.png" },
    { id: 2, name: "Nitro Mug", price: randomPrice(), image: "/nitropay-mug.png" },
    { id: 3, name: "Nitro Shoes", price: randomPrice(), image: "/nitropay-shoes.png" },
  ];

export default function CheckoutPage() {
    const total = products.reduce((sum, p) => sum + p.price, 0).toFixed(2);
    return (
        <div className="p-6 flex flex-col items-center">
            <h2 className="text-3xl font-bold mb-6 text-center">Merchant Demo Checkout</h2>

            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-6xl flex flex-col lg:flex-row gap-8">
                <div className="flex-1 w-full lg:min-w-[400px]">
                    <ProductList products={products} />
                </div>
                <div className="w-full lg:w-96">
                    <PaymentForm total={total} />
                </div>
            </div>
        </div>
    );
}
