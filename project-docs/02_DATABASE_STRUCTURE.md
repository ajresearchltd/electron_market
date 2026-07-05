# Database Structure

## Project Name

Electron Market

## Purpose

This document describes the database structure for the Electron Market project.

The project is created from scratch.

The database includes two main areas:

1. Product catalog
2. RFQ and supplier quotation system

The first development stage should focus on the RFQ system, but the product catalog structure is also included because RFQ requests and products will later be connected.

---

# 1. Core User and Supplier Tables

These tables are required because products, RFQ records, messages and supplier quotations refer to users and suppliers.

---

## Table: Users

Stores all system users.

### Fields

| Field Name | Type |
|---|---|
| User_ID | UUID |
| Email | Text |
| Full_Name | Text |
| Role | Text |
| Company_ID | Link |
| Phone | Text |
| User_Status | Text |
| Created_Date | DateTime |
| Updated_Date | DateTime |

### Primary Key

User_ID

### Role Values

- buyer
- supplier
- admin

### Notes

Supabase Auth may be used for authentication.

The `Users` table stores additional profile and role information.

---

## Table: Suppliers

Stores supplier companies.

### Fields

| Field Name | Type |
|---|---|
| Supplier_ID | UUID |
| Supplier_Name | Text |
| Company_Name | Text |
| Supplier_Type | Text |
| Business_Type | Text |
| Country | Text |
| City | Text |
| Website | Text |
| Contact_Email | Text |
| Contact_Phone | Text |
| Verified_Supplier | Yes/No |
| Official_Authorized_Distributor | Yes/No |
| Supplier_Status | Text |
| Created_Date | DateTime |
| Updated_Date | DateTime |

### Primary Key

Supplier_ID

### Notes

Suppliers can provide products and receive RFQ requests.

---

# 2. Product Catalog

The product catalog stores electronic products, their specifications, images, documents, delivery options, alternative products and services.

---

## Table: Products

This is the main product table.

### Fields

| Field Name | Type |
|---|---|
| Product_ID | UUID |
| Product_Type | Text |
| Product_Name | Text |
| Category | Text |
| Subcategory | Text |
| Brand_Manufacturer | Text |
| Model_Series | Text |
| Part_Number_MPN | Text |
| SKU_Internal | Text |
| GTIN_EAN | Text |
| Country_Of_Origin | Text |
| Short_Description | Long Text |
| Full_Description | Long Text |
| Supplier_Type | Text |
| Business_Type | Text |
| Number_Of_Suppliers | Number |
| Number_Of_Manufacturers | Number |
| Verified_Suppliers | Yes/No |
| Official_Authorized_Distributor | Yes/No |
| Availability | Text |
| Stock_Location | Text |
| MOQ_Quantity | Number |
| MOQ_Unit | Text |
| Price_Type | Text |
| Base_Price | Number |
| Base_Currency | Text |
| Min_Price | Number |
| Max_Price | Number |
| Price_Range_Currency | Text |
| Price_On_Request | Yes/No |
| Lead_Time | Text |
| Delivery_Time_Estimated | Text |
| Shipping_Methods | Text |
| Delivery_Countries | Text |
| Packaging_Details | Long Text |
| HS_Code | Text |
| Installation_Available | Yes/No |
| Training_Available | Yes/No |
| Maintenance_Available | Yes/No |
| Technical_Support | Yes/No |
| Spare_Parts_Available | Yes/No |
| Customization_Available | Yes/No |
| Service_Description | Long Text |
| Meta_Title | Text |
| Meta_Description | Long Text |
| Visibility | Text |
| Warranty | Text |
| Return_Policy | Text |
| Condition | Text |
| Notes | Long Text |
| Product_Status | Text |
| Main_Image_URL | Text |
| Created_Date | DateTime |
| Updated_Date | DateTime |
| Supplier_ID | Link |
| Created_By_User_ID | Link |

### Primary Key

Product_ID

### Foreign Keys

| Field | References |
|---|---|
| Supplier_ID | Suppliers.Supplier_ID |
| Created_By_User_ID | Users.User_ID |

### Notes

This table was previously described as "MAIN PAGE", but in the database it must be named `Products`.

---

## Table: ProductSpecifications

Stores product technical specifications.

### Fields

| Field Name | Type |
|---|---|
| Specification_ID | UUID |
| Product_ID | Link |
| Specification_Name | Text |
| Specification_Value | Text |
| Unit | Text |

### Primary Key

Specification_ID

### Foreign Key

| Field | References |
|---|---|
| Product_ID | Products.Product_ID |

---

## Table: ProductImages

Stores product images.

### Fields

| Field Name | Type |
|---|---|
| Image_ID | UUID |
| Product_ID | Link |
| Image_URL | Text |
| Image_Title | Text |
| Is_Main_Image | Yes/No |
| Sort_Order | Number |

### Primary Key

Image_ID

### Foreign Key

| Field | References |
|---|---|
| Product_ID | Products.Product_ID |

---

## Table: ProductDocuments

Stores product documents, certificates, datasheets and manuals.

### Fields

| Field Name | Type |
|---|---|
| Document_ID | UUID |
| Product_ID | Link |
| Document_Type | Text |
| Document_Name | Text |
| File_URL | Text |

### Primary Key

Document_ID

### Foreign Key

| Field | References |
|---|---|
| Product_ID | Products.Product_ID |

---

## Table: ProductShippingMethods

Stores shipping methods available for each product.

### Fields

| Field Name | Type |
|---|---|
| Shipping_Method_ID | UUID |
| Product_ID | Link |
| Shipping_Method | Text |

### Primary Key

Shipping_Method_ID

### Foreign Key

| Field | References |
|---|---|
| Product_ID | Products.Product_ID |

---

## Table: ProductDeliveryCountries

Stores countries where a product can be delivered.

### Fields

| Field Name | Type |
|---|---|
| Country_ID | UUID |
| Product_ID | Link |
| Country_Name | Text |

### Primary Key

Country_ID

### Foreign Key

| Field | References |
|---|---|
| Product_ID | Products.Product_ID |

---

## Table: AlternativeProducts

Stores alternative or substitute products.

### Fields

| Field Name | Type |
|---|---|
| Alternative_ID | UUID |
| Product_ID | Link |
| Alternative_Part_Number | Text |
| Alternative_Product_Name | Text |
| Alternative_Manufacturer_Brand | Text |

### Primary Key

Alternative_ID

### Foreign Key

| Field | References |
|---|---|
| Product_ID | Products.Product_ID |

---

## Table: ProductServices

Stores service options connected with a product.

### Fields

| Field Name | Type |
|---|---|
| Service_ID | UUID |
| Product_ID | Link |
| Installation_Available | Yes/No |
| Training_Available | Yes/No |
| Maintenance_Available | Yes/No |
| Technical_Support | Yes/No |
| Spare_Parts_Available | Yes/No |
| Customization_Available | Yes/No |
| Service_Description | Long Text |

### Primary Key

Service_ID

### Foreign Key

| Field | References |
|---|---|
| Product_ID | Products.Product_ID |

---

# 3. Product Catalog Relationships

## Product Relationship Diagram

Products
|
|-- ProductSpecifications
|      Product_ID references Products.Product_ID
|
|-- ProductImages
|      Product_ID references Products.Product_ID
|
|-- ProductDocuments
|      Product_ID references Products.Product_ID
|
|-- ProductShippingMethods
|      Product_ID references Products.Product_ID
|
|-- ProductDeliveryCountries
|      Product_ID references Products.Product_ID
|
|-- AlternativeProducts
|      Product_ID references Products.Product_ID
|
|-- ProductServices
|      Product_ID references Products.Product_ID

## Explicit Product Relationships

| Parent Table | Parent Field | Child Table | Child Field | Relationship Type |
|---|---|---|---|---|
| Suppliers | Supplier_ID | Products | Supplier_ID | One-to-Many |
| Users | User_ID | Products | Created_By_User_ID | One-to-Many |
| Products | Product_ID | ProductSpecifications | Product_ID | One-to-Many |
| Products | Product_ID | ProductImages | Product_ID | One-to-Many |
| Products | Product_ID | ProductDocuments | Product_ID | One-to-Many |
| Products | Product_ID | ProductShippingMethods | Product_ID | One-to-Many |
| Products | Product_ID | ProductDeliveryCountries | Product_ID | One-to-Many |
| Products | Product_ID | AlternativeProducts | Product_ID | One-to-Many |
| Products | Product_ID | ProductServices | Product_ID | One-to-One or One-to-Many |

---

# 4. RFQ System

The RFQ system allows buyers to create requests for quotation, add requested items, upload BOM files, send RFQs to selected suppliers, receive supplier quotes and communicate with suppliers.

---

## Table: RFQ

Main RFQ table.

### Fields

| Field Name | Type |
|---|---|
| RFQ_ID | UUID |
| RFQ_Name | Text |
| RFQ_Type | Text |
| RFQ_Visibility | Text |
| Project_Description | Long Text |
| Required_Delivery_Date | DateTime |
| Incoterms_Preference | Text |
| Destination_Country | Text |
| Target_Budget | Number |
| Official_Suppliers_Only | Yes/No |
| Manufacturers_Only | Yes/No |
| Include_Substitute_Alternate_Parts | Yes/No |
| Need_Technical_Support | Yes/No |
| RFQ_Status | Text |
| Created_By_User_ID | Link |
| Created_Date | DateTime |
| Updated_Date | DateTime |

### Primary Key

RFQ_ID

### Foreign Key

| Field | References |
|---|---|
| Created_By_User_ID | Users.User_ID |

### Status Values

- draft
- sent
- supplier_review
- quoted
- closed
- cancelled

---

## Table: RFQ_Items

Stores products/items requested inside an RFQ.

### Fields

| Field Name | Type |
|---|---|
| RFQ_Item_ID | UUID |
| RFQ_ID | Link |
| Rec_Num | Number |
| Part_Num | Text |
| Name_Of_Detail | Text |
| Specification | Long Text |
| Amount | Number |
| Additional_Info | Long Text |

### Primary Key

RFQ_Item_ID

### Foreign Key

| Field | References |
|---|---|
| RFQ_ID | RFQ.RFQ_ID |

### Notes

One RFQ can contain many RFQ items.

---

## Table: RFQ_BOM_Files

Stores uploaded BOM files.

### Fields

| Field Name | Type |
|---|---|
| BOM_File_ID | UUID |
| RFQ_ID | Link |
| BOM_File_URL | Text |
| BOM_File_Name | Text |
| BOM_File_Type | Text |
| BOM_File_Size | Number |
| Uploaded_Date | DateTime |
| AI_Analysis_Status | Text |
| AI_Matched_Suppliers_Count | Number |

### Primary Key

BOM_File_ID

### Foreign Key

| Field | References |
|---|---|
| RFQ_ID | RFQ.RFQ_ID |

### Notes

This table is prepared for future AI BOM analysis.

---

## Table: RFQ_Target_Suppliers

Stores suppliers selected for a specific RFQ.

### Fields

| Field Name | Type |
|---|---|
| RFQ_Target_Supplier_ID | UUID |
| RFQ_ID | Link |
| Supplier_ID | Link |
| Send_Status | Text |
| Sent_Date | DateTime |
| Viewed_Date | DateTime |
| Quote_Status | Text |

### Primary Key

RFQ_Target_Supplier_ID

### Foreign Keys

| Field | References |
|---|---|
| RFQ_ID | RFQ.RFQ_ID |
| Supplier_ID | Suppliers.Supplier_ID |

### Send Status Values

- draft
- sent
- viewed
- failed

### Quote Status Values

- waiting
- quoted
- declined
- expired

### Notes

This table is required because one RFQ can be sent to many suppliers.

One supplier can receive many RFQs.

---

## Table: RFQ_Quotes

Stores commercial quotations from suppliers.

### Fields

| Field Name | Type |
|---|---|
| Quote_ID | UUID |
| RFQ_ID | Link |
| RFQ_Target_Supplier_ID | Link |
| Supplier_ID | Link |
| Quote_Status | Text |
| Total_Amount | Number |
| Currency | Text |
| Delivery_Time | Text |
| Incoterms | Text |
| Supplier_Comment | Long Text |
| Created_Date | DateTime |

### Primary Key

Quote_ID

### Foreign Keys

| Field | References |
|---|---|
| RFQ_ID | RFQ.RFQ_ID |
| RFQ_Target_Supplier_ID | RFQ_Target_Suppliers.RFQ_Target_Supplier_ID |
| Supplier_ID | Suppliers.Supplier_ID |

### Quote Status Values

- draft
- submitted
- revised
- accepted
- rejected
- expired

### Notes

One supplier can submit a quote for an RFQ.

A quote can contain many quoted items.

---

## Table: RFQ_Quote_Items

Stores item-level details of supplier quotations.

### Fields

| Field Name | Type |
|---|---|
| Quote_Item_ID | UUID |
| Quote_ID | Link |
| RFQ_Item_ID | Link |
| Offered_Part_Num | Text |
| Offered_Name_Of_Detail | Text |
| Offered_Specification | Long Text |
| Offered_Amount | Number |
| Unit_Price | Number |
| Total_Price | Number |
| Currency | Text |
| Is_Substitute_Alternate | Yes/No |
| Delivery_Time | Text |
| Comment | Long Text |

### Primary Key

Quote_Item_ID

### Foreign Keys

| Field | References |
|---|---|
| Quote_ID | RFQ_Quotes.Quote_ID |
| RFQ_Item_ID | RFQ_Items.RFQ_Item_ID |

### Notes

This table connects what the buyer requested with what the supplier offered.

Important relationship:

RFQ_Items.RFQ_Item_ID → RFQ_Quote_Items.RFQ_Item_ID

RFQ_Quotes.Quote_ID → RFQ_Quote_Items.Quote_ID

This allows comparison between the buyer's requested item and the supplier's offered item.

---

## Table: RFQ_Messages

Stores messages between buyers and suppliers related to RFQ.

### Fields

| Field Name | Type |
|---|---|
| Message_ID | UUID |
| RFQ_ID | Link |
| Supplier_ID | Link |
| Sender_User_ID | Link |
| Receiver_User_ID | Link |
| Message_Subject | Text |
| Message_Text | Long Text |
| Message_Status | Text |
| Sent_Date | DateTime |
| Read_Date | DateTime |

### Primary Key

Message_ID

### Foreign Keys

| Field | References |
|---|---|
| RFQ_ID | RFQ.RFQ_ID |
| Supplier_ID | Suppliers.Supplier_ID |
| Sender_User_ID | Users.User_ID |
| Receiver_User_ID | Users.User_ID |

### Message Status Values

- sent
- delivered
- read
- archived

---

# 5. RFQ Relationships

## RFQ Relationship Diagram

RFQ
|
|-- RFQ_Items
|      RFQ_ID references RFQ.RFQ_ID
|
|-- RFQ_BOM_Files
|      RFQ_ID references RFQ.RFQ_ID
|
|-- RFQ_Target_Suppliers
|      RFQ_ID references RFQ.RFQ_ID
|      Supplier_ID references Suppliers.Supplier_ID
|
|-- RFQ_Quotes
|      RFQ_ID references RFQ.RFQ_ID
|      RFQ_Target_Supplier_ID references RFQ_Target_Suppliers.RFQ_Target_Supplier_ID
|      Supplier_ID references Suppliers.Supplier_ID
|
|-- RFQ_Quote_Items
|      Quote_ID references RFQ_Quotes.Quote_ID
|      RFQ_Item_ID references RFQ_Items.RFQ_Item_ID
|
|-- RFQ_Messages
       RFQ_ID references RFQ.RFQ_ID
       Supplier_ID references Suppliers.Supplier_ID
       Sender_User_ID references Users.User_ID
       Receiver_User_ID references Users.User_ID

## Explicit RFQ Relationships

| Parent Table | Parent Field | Child Table | Child Field | Relationship Type |
|---|---|---|---|---|
| Users | User_ID | RFQ | Created_By_User_ID | One-to-Many |
| RFQ | RFQ_ID | RFQ_Items | RFQ_ID | One-to-Many |
| RFQ | RFQ_ID | RFQ_BOM_Files | RFQ_ID | One-to-Many |
| RFQ | RFQ_ID | RFQ_Target_Suppliers | RFQ_ID | One-to-Many |
| Suppliers | Supplier_ID | RFQ_Target_Suppliers | Supplier_ID | One-to-Many |
| RFQ | RFQ_ID | RFQ_Quotes | RFQ_ID | One-to-Many |
| RFQ_Target_Suppliers | RFQ_Target_Supplier_ID | RFQ_Quotes | RFQ_Target_Supplier_ID | One-to-One or One-to-Many |
| Suppliers | Supplier_ID | RFQ_Quotes | Supplier_ID | One-to-Many |
| RFQ_Quotes | Quote_ID | RFQ_Quote_Items | Quote_ID | One-to-Many |
| RFQ_Items | RFQ_Item_ID | RFQ_Quote_Items | RFQ_Item_ID | One-to-Many |
| RFQ | RFQ_ID | RFQ_Messages | RFQ_ID | One-to-Many |
| Suppliers | Supplier_ID | RFQ_Messages | Supplier_ID | One-to-Many |
| Users | User_ID | RFQ_Messages | Sender_User_ID | One-to-Many |
| Users | User_ID | RFQ_Messages | Receiver_User_ID | One-to-Many |

---

# 6. Implementation Rules for Codex

## Database Naming

When implementing in Supabase/PostgreSQL, Codex may convert names to lowercase snake_case.

Examples:

| Documentation Name | Database Name |
|---|---|
| Users | users |
| Suppliers | suppliers |
| Products | products |
| ProductSpecifications | product_specifications |
| ProductImages | product_images |
| ProductDocuments | product_documents |
| ProductShippingMethods | product_shipping_methods |
| ProductDeliveryCountries | product_delivery_countries |
| AlternativeProducts | alternative_products |
| ProductServices | product_services |
| RFQ | rfq |
| RFQ_Items | rfq_items |
| RFQ_BOM_Files | rfq_bom_files |
| RFQ_Target_Suppliers | rfq_target_suppliers |
| RFQ_Quotes | rfq_quotes |
| RFQ_Quote_Items | rfq_quote_items |
| RFQ_Messages | rfq_messages |

## Field Naming

Codex may convert field names to lowercase snake_case.

Examples:

| Documentation Field | Database Field |
|---|---|
| User_ID | user_id |
| Supplier_ID | supplier_id |
| Product_ID | product_id |
| RFQ_ID | rfq_id |
| RFQ_Item_ID | rfq_item_id |
| Quote_ID | quote_id |
| Created_Date | created_date |
| Updated_Date | updated_date |

## ID Rule

All primary keys should use UUID.

## Date Rule

All date and datetime fields should use timestamp or date-time types.

## Foreign Key Rule

All relationships described in this document should be implemented as foreign keys.

Examples:

- rfq_items.rfq_id references rfq.rfq_id
- rfq_bom_files.rfq_id references rfq.rfq_id
- rfq_target_suppliers.rfq_id references rfq.rfq_id
- rfq_target_suppliers.supplier_id references suppliers.supplier_id
- rfq_quotes.rfq_id references rfq.rfq_id
- rfq_quotes.rfq_target_supplier_id references rfq_target_suppliers.rfq_target_supplier_id
- rfq_quotes.supplier_id references suppliers.supplier_id
- rfq_quote_items.quote_id references rfq_quotes.quote_id
- rfq_quote_items.rfq_item_id references rfq_items.rfq_item_id
- rfq_messages.rfq_id references rfq.rfq_id
- rfq_messages.supplier_id references suppliers.supplier_id
- rfq_messages.sender_user_id references users.user_id
- rfq_messages.receiver_user_id references users.user_id

---

# 7. Development Priority

## First Stage

The first working version should focus on the RFQ module.

Recommended first-stage tables:

- users
- suppliers
- rfq
- rfq_items
- rfq_bom_files
- rfq_target_suppliers
- rfq_quotes
- rfq_quote_items
- rfq_messages

The product catalog structure is included for planning, but it does not need to be fully implemented in the first stage unless explicitly requested.

## Second Stage

After the RFQ module works, implement the product catalog:

- products
- product_specifications
- product_images
- product_documents
- product_shipping_methods
- product_delivery_countries
- alternative_products
- product_services

## Future Modules

Future modules may include:

- buyer dashboard
- supplier dashboard
- admin dashboard
- product catalog search
- supplier catalog
- order management
- file uploads
- notifications
- email automation
- AI assistant
- AI BOM analysis
- AI product matching
- payment integration