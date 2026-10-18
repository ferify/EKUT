-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Oct 1, 2026 at 00:01 PM
-- Server version: 8.4.3
-- PHP Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ekut_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `customer_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`customer_id`, `name`, `phone`, `created_at`) VALUES
(1, 'Pelanggan 1', '081212121212', '2026-10-01 00:00:01'),
(2, 'Pelanggan 2', '081313131313', '2026-10-01 00:00:01'),
(3, 'Pelanggan 3', '081414141414', '2026-10-01 00:00:01'),
(4, 'Pelanggan 4', '081515151515', '2026-10-01 00:00:01'),
(5, 'Pelanggan 5', '081616161616', '2026-10-01 00:00:01');

-- --------------------------------------------------------

--
-- Table structure for table `customer_otps`
--

CREATE TABLE `customer_otps` (
  `phone` varchar(20) NOT NULL,
  `code_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `menus`
--

CREATE TABLE `menus` (
  `menu_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `menu_name` varchar(100) NOT NULL,
  `description` text,
  `category` varchar(50) DEFAULT NULL,
  `price` decimal(12,2) NOT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `photo` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `menus`
--

INSERT INTO `menus` (`menu_id`, `tenant_id`, `menu_name`, `description`, `category`, `price`, `quantity`, `photo`, `status`, `created_at`) VALUES
(1, 1, 'Ayam Geprek Original', 'Ayam geprek dengan sambal bawang', 'Makanan', 18000.00, 20, NULL, 'available', '2026-10-01 00:00:01'),
(2, 1, 'Ayam Geprek Keju', 'Ayam geprek dengan topping keju', 'Makanan', 22000.00, 15, NULL, 'available', '2026-10-01 00:00:01'),
(3, 1, 'Es Teh Manis', 'Es teh manis segar', 'Minuman', 5000.00, 30, NULL, 'available', '2026-10-01 00:00:01'),
(4, 2, 'Jus Alpukat', 'Jus alpukat segar', 'Minuman', 12000.00, 20, NULL, 'available', '2026-10-01 00:00:01'),
(5, 2, 'Jus Mangga', 'Jus mangga segar', 'Minuman', 12000.00, 20, NULL, 'available', '2026-10-01 00:00:01'),
(6, 2, 'Jus Jambu', 'Jus jambu merah segar', 'Minuman', 10000.00, 15, NULL, 'available', '2026-10-01 00:00:01'),
(7, 3, 'Chocolate Cake', 'Cake cokelat lembut', 'Dessert', 18000.00, 10, NULL, 'available', '2026-10-01 00:00:01'),
(8, 3, 'Cheesecake', 'Cheesecake creamy', 'Dessert', 20000.00, 10, NULL, 'available', '2026-10-01 00:00:01'),
(9, 3, 'Pudding', 'Pudding vanilla', 'Dessert', 10000.00, 15, NULL, 'available', '2026-10-01 00:00:01'),
(10, 4, 'Mie Ayam', 'Mie ayam dengan topping ayam', 'Makanan', 15000.00, 20, NULL, 'available', '2026-10-01 00:00:01'),
(11, 4, 'Bakso', 'Bakso kuah', 'Makanan', 15000.00, 20, NULL, 'available', '2026-10-01 00:00:01'),
(12, 4, 'Mie Ayam Bakso', 'Mie ayam dengan tambahan bakso', 'Makanan', 20000.00, 15, NULL, 'available', '2026-10-01 00:00:01'),
(13, 5, 'Pasta Carbonara', 'Pasta dengan saus carbonara', 'Makanan', 25000.00, 15, NULL, 'available', '2026-10-01 00:00:01'),
(14, 5, 'Spaghetti Bolognese', 'Spaghetti dengan saus bolognese', 'Makanan', 25000.00, 15, NULL, 'available', '2026-10-01 00:00:01'),
(15, 5, 'Coffee Latte', 'Kopi latte', 'Minuman', 18000.00, 20, NULL, 'available', '2026-10-01 00:00:01'),
(16, 6, 'Kue Lapis', 'Kue lapis tradisional', 'Dessert', 8000.00, 20, NULL, 'available', '2026-10-01 00:00:01'),
(17, 6, 'Klepon', 'Klepon gula merah', 'Kue & Jajanan', 7000.00, 25, NULL, 'available', '2026-10-01 00:00:01'),
(18, 6, 'Risoles', 'Risoles isi sayuran', 'Kue & Jajanan', 8000.00, 20, NULL, 'available', '2026-10-01 00:00:01');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `order_id` int NOT NULL,
  `order_number` varchar(30) NOT NULL,
  `customer_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `order_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_amount` decimal(12,2) NOT NULL,
  `order_status` varchar(30) NOT NULL,
  `queue_number` varchar(20) DEFAULT NULL,
  `queue_seq` int DEFAULT NULL,
  `queue_date` date DEFAULT NULL,
  `scheduled_for` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`order_id`, `order_number`, `customer_id`, `tenant_id`, `order_date`, `total_amount`, `order_status`, `queue_number`, `queue_seq`, `queue_date`, `scheduled_for`) VALUES
(1, 'ORD-20261001-001', 1, 1, '2026-10-01 00:00:01', 41000.00, 'completed', NULL, NULL, NULL, NULL),
(2, 'ORD-20261001-002', 2, 4, '2026-10-01 00:00:01', 35000.00, 'preparing', NULL, NULL, NULL, NULL),
(3, 'ORD-20261001-003', 3, 5, '2026-10-01 00:00:01', 43000.00, 'pending', NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `order_item_id` int NOT NULL,
  `order_id` int NOT NULL,
  `menu_id` int NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`order_item_id`, `order_id`, `menu_id`, `quantity`, `price`, `subtotal`) VALUES
(1, 1, 1, 2, 18000.00, 36000.00),
(2, 1, 3, 1, 5000.00, 5000.00),
(3, 2, 10, 1, 15000.00, 15000.00),
(4, 2, 12, 1, 20000.00, 20000.00),
(5, 3, 13, 1, 25000.00, 25000.00),
(6, 3, 15, 1, 18000.00, 18000.00);

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `payment_id` int NOT NULL,
  `order_id` int NOT NULL,
  `payment_method` varchar(30) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` datetime DEFAULT NULL,
  `payment_status` varchar(30) NOT NULL,
  `payment_reference` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`payment_id`, `order_id`, `payment_method`, `amount`, `payment_date`, `payment_status`, `payment_reference`) VALUES
(1, 1, 'QRIS', 41000.00, '2026-10-01 00:00:01', 'paid', 'QRIS-001'),
(2, 2, 'QRIS', 35000.00, '2026-10-01 00:00:01', 'paid', 'QRIS-002'),
(3, 3, 'QRIS', 43000.00, NULL, 'pending', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `rental_payments`
--

CREATE TABLE `rental_payments` (
  `rental_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `rental_period` varchar(20) NOT NULL,
  `due_date` date NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` datetime DEFAULT NULL,
  `payment_proof` varchar(255) DEFAULT NULL,
  `status` varchar(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `rental_payments`
--

INSERT INTO `rental_payments` (`rental_id`, `tenant_id`, `rental_period`, `due_date`, `amount`, `payment_date`, `payment_proof`, `status`) VALUES
(1, 1, '2026-10', '2026-10-05', 500000.00, '2026-10-03 10:00:00', 'proof_tenant_1.jpg', 'paid'),
(2, 2, '2026-10', '2026-10-05', 500000.00, '2026-10-04 11:00:00', 'proof_tenant_2.jpg', 'paid'),
(3, 3, '2026-10', '2026-10-05', 500000.00, NULL, NULL, 'pending'),
(4, 4, '2026-10', '2026-10-05', 500000.00, '2026-10-02 09:00:00', 'proof_tenant_4.jpg', 'paid'),
(5, 5, '2026-10', '2026-10-05', 500000.00, NULL, NULL, 'overdue'),
(6, 6, '2026-10', '2026-10-05', 500000.00, '2026-10-04 14:00:00', 'proof_tenant_6.jpg', 'paid');

-- --------------------------------------------------------

--
-- Table structure for table `reviews`
--

CREATE TABLE `reviews` (
  `review_id` int NOT NULL,
  `order_item_id` int NOT NULL,
  `order_id` int NOT NULL,
  `menu_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `customer_name` varchar(100) NOT NULL,
  `customer_phone` varchar(20) NOT NULL,
  `rating` tinyint NOT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `comment` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ;

-- --------------------------------------------------------

--
-- Table structure for table `tenants`
--

CREATE TABLE `tenants` (
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `tenant_name` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `bank_name` varchar(50) DEFAULT NULL,
  `bank_account` varchar(50) DEFAULT NULL,
  `profile_photo` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `is_open` tinyint(1) NOT NULL DEFAULT '1',
  `category` varchar(50) DEFAULT NULL,
  `queue_prefix` varchar(6) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `tenants`
--

INSERT INTO `tenants` (`tenant_id`, `user_id`, `tenant_name`, `phone`, `bank_name`, `bank_account`, `profile_photo`, `status`, `is_open`, `category`, `queue_prefix`, `created_at`) VALUES
(1, 2, 'Ayam Geprek Twilight Sparkle', '081234567802', 'BCA', '1234567802', '/uploads/tenant-1-3d7637ae4f17c9432b8fc1c8.png', 'active', 1, 'Makanan', 'AGT', '2026-10-01 00:00:01'),
(2, 3, 'Jus Juah Applejack', '081234567803', 'BCA', '1234567803', NULL, 'active', 1, 'Minuman', NULL, '2026-10-01 00:00:01'),
(3, 4, 'Dessert Pinkiepie', '081234567804', 'BCA', '1234567804', NULL, 'active', 1, 'Dessert', NULL, '2026-10-01 00:00:01'),
(4, 5, 'Mie Ayam Bakso Fluttershy', '081234567805', 'BCA', '1234567805', NULL, 'active', 1, 'Makanan', NULL, '2026-10-01 00:00:01'),
(5, 6, 'Pasta and Coffee Rarity', '081234567806', 'BCA', '1234567806', NULL, 'active', 1, 'Pasta & Coffee', NULL, '2026-10-01 00:00:01'),
(6, 7, 'Kue Basah Rainbowdash', '081234567807', 'BCA', '1234567807', NULL, 'active', 1, 'Kue & Jajanan', NULL, '2026-10-01 00:00:01');

-- --------------------------------------------------------

--
-- Table structure for table `tenant_queue_counters`
--

CREATE TABLE `tenant_queue_counters` (
  `tenant_id` int NOT NULL,
  `queue_date` date NOT NULL,
  `last_number` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `transfers`
--

CREATE TABLE `transfers` (
  `transfer_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `bank_name` varchar(50) DEFAULT NULL,
  `bank_account` varchar(50) DEFAULT NULL,
  `status` varchar(30) NOT NULL,
  `reference_number` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `transfers`
--

INSERT INTO `transfers` (`transfer_id`, `tenant_id`, `transfer_date`, `amount`, `bank_name`, `bank_account`, `status`, `reference_number`) VALUES
(1, 1, '2026-10-01 19:00:00', 41000.00, 'BCA', '1234567802', 'completed', 'TRF-20261001-001'),
(2, 4, '2026-10-01 19:05:00', 35000.00, 'BCA', '1234567805', 'completed', 'TRF-20261001-002'),
(3, 3, '2026-10-16 07:57:57', 54000.00, 'BCA', '1234567804', 'completed', '1234567804');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `password`, `role`, `status`, `created_at`) VALUES
(1, 'admin_ekut', 'dummy_admin', 'admin', 'active', '2026-10-01 00:00:01'),
(2, 'ayam_geprek_twilight_sparkle', 'dummy_tenant1', 'tenant', 'active', '2026-10-01 00:00:01'),
(3, 'jus_juah_applejack', 'dummy_tenant2', 'tenant', 'active', '2026-10-01 00:00:01'),
(4, 'dessert_pinkiepie', 'dummy_tenant3', 'tenant', 'active', '2026-10-01 00:00:01'),
(5, 'mie_ayam_bakso_fluttershy', 'dummy_tenant4', 'tenant', 'active', '2026-10-01 00:00:01'),
(6, 'pasta_and_coffee_rarity', 'dummy_tenant5', 'tenant', 'active', '2026-10-01 00:00:01'),
(7, 'kue_basah_rainbowdash', 'dummy_tenant6', 'tenant', 'active', '2026-10-01 00:00:01');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`customer_id`),
  ADD KEY `idx_customers_phone` (`phone`);

--
-- Indexes for table `customer_otps`
--
ALTER TABLE `customer_otps`
  ADD PRIMARY KEY (`phone`);

--
-- Indexes for table `menus`
--
ALTER TABLE `menus`
  ADD PRIMARY KEY (`menu_id`),
  ADD KEY `fk_menu_tenant` (`tenant_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`order_id`),
  ADD UNIQUE KEY `order_number` (`order_number`),
  ADD UNIQUE KEY `uq_orders_queue` (`tenant_id`,`queue_date`,`queue_seq`),
  ADD KEY `fk_order_customer` (`tenant_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`order_item_id`),
  ADD KEY `fk_item_order` (`order_id`),
  ADD KEY `fk_item_menu` (`menu_id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD UNIQUE KEY `order_id` (`order_id`);

--
-- Indexes for table `rental_payments`
--
ALTER TABLE `rental_payments`
  ADD PRIMARY KEY (`rental_id`),
  ADD KEY `fk_rental_tenant` (`tenant_id`);

--
-- Indexes for table `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`review_id`),
  ADD UNIQUE KEY `uq_review_order_item` (`order_item_id`),
  ADD KEY `idx_review_menu` (`menu_id`),
  ADD KEY `idx_review_tenant` (`tenant_id`),
  ADD KEY `fk_review_order` (`order_id`);

--
-- Indexes for table `tenants`
--
ALTER TABLE `tenants`
  ADD PRIMARY KEY (`tenant_id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD UNIQUE KEY `uq_tenants_queue_prefix` (`queue_prefix`);

--
-- Indexes for table `tenant_queue_counters`
--
ALTER TABLE `tenant_queue_counters`
  ADD PRIMARY KEY (`tenant_id`,`queue_date`);

--
-- Indexes for table `transfers`
--
ALTER TABLE `transfers`
  ADD PRIMARY KEY (`transfer_id`),
  ADD KEY `fk_transfer_tenant` (`tenant_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `customer_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `menus`
--
ALTER TABLE `menus`
  MODIFY `menu_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `order_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `order_item_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `payment_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `rental_payments`
--
ALTER TABLE `rental_payments`
  MODIFY `rental_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `reviews`
--
ALTER TABLE `reviews`
  MODIFY `review_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tenants`
--
ALTER TABLE `tenants`
  MODIFY `tenant_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `transfers`
--
ALTER TABLE `transfers`
  MODIFY `transfer_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `menus`
--
ALTER TABLE `menus`
  ADD CONSTRAINT `fk_menu_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`);

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_order_customer` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`);

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_item_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`menu_id`),
  ADD CONSTRAINT `fk_item_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`);

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_payment_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`);

--
-- Constraints for table `rental_payments`
--
ALTER TABLE `rental_payments`
  ADD CONSTRAINT `fk_rental_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`);

--
-- Constraints for table `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `fk_review_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`order_item_id`),
  ADD CONSTRAINT `fk_review_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus` (`menu_id`),
  ADD CONSTRAINT `fk_review_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`),
  ADD CONSTRAINT `fk_review_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`);

--
-- Constraints for table `tenants`
--
ALTER TABLE `tenants`
  ADD CONSTRAINT `fk_tenant_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `tenant_queue_counters`
--
ALTER TABLE `tenant_queue_counters`
  ADD CONSTRAINT `fk_queue_counter_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`);

--
-- Constraints for table `transfers`
--
ALTER TABLE `transfers`
  ADD CONSTRAINT `fk_transfer_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
